use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreateSalePayload, Sale, SaleItem, SaleWithItems},
};

/// Core POS transaction. Runs as a single database transaction:
///   1. Insert sale header
///   2. Insert each sale_item
///   3. Insert inventory_movement (type = 'sale', delta = -quantity)
#[tauri::command]
pub async fn create_sale(
    state:   State<'_, AppState>,
    payload: CreateSalePayload,
) -> Result<Sale, AppError> {
    if payload.items.is_empty() {
        return Err(AppError { message: "Sale must have at least one item".into() });
    }

    let mut tx = state.db.begin().await?;

    // Calculate totals from items
    let mut subtotal:  i64 = 0;
    let mut total_tax: i64 = 0;

    for item in &payload.items {
        let line = (item.unit_price as f64 * item.quantity).round() as i64
            - item.discount.unwrap_or(0);
        subtotal  += line;
        total_tax += item.tva_amount.unwrap_or(0);
    }

    let order_discount = payload.discount.unwrap_or(0);
    let total_amount   = subtotal - order_discount + total_tax;
    let change_given   = (payload.amount_paid - total_amount).max(0);

    // 1. Insert sale header
    let sale = sqlx::query_as::<_, Sale>(
        r#"
        INSERT INTO sales
            (session_id, cashier_id, customer_id,
             subtotal, discount, tax, total_amount,
             amount_paid, change_given, payment_method, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        "#,
    )
    .bind(payload.session_id)
    .bind(payload.cashier_id)
    .bind(payload.customer_id)
    .bind(subtotal)
    .bind(order_discount)
    .bind(total_tax)
    .bind(total_amount)
    .bind(payload.amount_paid)
    .bind(change_given)
    .bind(payload.payment_method.as_deref().unwrap_or("cash"))
    .bind(payload.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    // 2 & 3. Insert items + stock movements
    for item in &payload.items {
        let line_subtotal = (item.unit_price as f64 * item.quantity).round() as i64
            - item.discount.unwrap_or(0);

        sqlx::query(
            r#"
            INSERT INTO sale_items
                (sale_id, product_id, quantity, unit_price, unit_cost,
                 price_tier, discount, tva_amount, subtotal)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            "#,
        )
        .bind(sale.id)
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(item.unit_cost)
        .bind(item.price_tier.as_deref().unwrap_or("retail"))
        .bind(item.discount.unwrap_or(0))
        .bind(item.tva_amount.unwrap_or(0))
        .bind(line_subtotal)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO inventory_movements
                (product_id, quantity_delta, movement_type, reference_id, created_by)
            VALUES ($1,$2,'sale',$3,$4)
            "#,
        )
        .bind(item.product_id)
        .bind(-item.quantity)
        .bind(sale.id)
        .bind(payload.cashier_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(sale)
}

#[tauri::command]
pub async fn get_sales(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
    cashier_id: Option<i64>,
    limit:     Option<i64>,
    offset:    Option<i64>,
) -> Result<Vec<Sale>, AppError> {
    let limit  = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let sales = sqlx::query_as::<_, Sale>(
        r#"
        SELECT * FROM sales
        WHERE status = 'completed'
          AND ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ)
          AND ($3::BIGINT IS NULL OR cashier_id = $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .bind(cashier_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(sales)
}

#[tauri::command]
pub async fn get_sale_by_id(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Option<SaleWithItems>, AppError> {
    let sale = sqlx::query_as::<_, Sale>("SELECT * FROM sales WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;

    let Some(sale) = sale else { return Ok(None) };

    let items = sqlx::query_as::<_, SaleItem>("SELECT * FROM sale_items WHERE sale_id = $1")
        .bind(id)
        .fetch_all(&state.db)
        .await?;

    Ok(Some(SaleWithItems { sale, items }))
}

/// Void a sale and restore stock.
#[tauri::command]
pub async fn void_sale(
    state:      State<'_, AppState>,
    sale_id:    i64,
    voided_by:  i64,
) -> Result<Sale, AppError> {
    let mut tx = state.db.begin().await?;

    let sale = sqlx::query_as::<_, Sale>(
        "UPDATE sales SET status = 'void' WHERE id = $1 AND status = 'completed' RETURNING *",
    )
    .bind(sale_id)
    .fetch_one(&mut *tx)
    .await?;

    // Restore stock for every item
    let items = sqlx::query_as::<_, SaleItem>("SELECT * FROM sale_items WHERE sale_id = $1")
        .bind(sale_id)
        .fetch_all(&mut *tx)
        .await?;

    for item in &items {
        sqlx::query(
            r#"
            INSERT INTO inventory_movements
                (product_id, quantity_delta, movement_type, reference_id, created_by, notes)
            VALUES ($1,$2,'return_in',$3,$4,'void of sale')
            "#,
        )
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(sale_id)
        .bind(voided_by)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(sale)
}
