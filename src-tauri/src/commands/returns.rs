use std::collections::HashMap;
use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreateReturnPayload, SaleReturn, SaleReturnItem, SaleReturnWithItems},
};

#[tauri::command]
pub async fn create_partial_return(
    state:   State<'_, AppState>,
    payload: CreateReturnPayload,
) -> Result<SaleReturnWithItems, AppError> {
    if payload.items.is_empty() {
        return Err(AppError { message: "Must return at least one item".into() });
    }

    let mut tx = state.db.begin().await?;

    // Verify sale exists and is in a returnable state
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM sales WHERE id = $1",
    )
    .bind(payload.original_sale_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (status,) = row.ok_or_else(|| AppError { message: "Sale not found".into() })?;
    if !matches!(status.as_str(), "completed" | "pending") {
        return Err(AppError {
            message: format!("Cannot return items from a '{status}' sale"),
        });
    }

    // Load already-returned quantities per sale_item for this sale
    let prior: Vec<(i64, f64)> = sqlx::query_as(
        r#"
        SELECT sri.sale_item_id, COALESCE(SUM(sri.quantity), 0.0) AS returned_qty
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.return_id
        WHERE sr.original_sale_id = $1
        GROUP BY sri.sale_item_id
        "#,
    )
    .bind(payload.original_sale_id)
    .fetch_all(&mut *tx)
    .await?;

    let returned_map: HashMap<i64, f64> = prior.into_iter().collect();

    // Validate each return item and accumulate total_refund
    let mut total_refund: i64 = 0;
    for item in &payload.items {
        if item.quantity <= 0.0 {
            return Err(AppError { message: "Return quantity must be positive".into() });
        }
        let row: Option<(f64, i64)> = sqlx::query_as(
            "SELECT quantity, unit_price FROM sale_items WHERE id = $1 AND sale_id = $2",
        )
        .bind(item.sale_item_id)
        .bind(payload.original_sale_id)
        .fetch_optional(&mut *tx)
        .await?;

        let (orig_qty, unit_price) = row.ok_or_else(|| AppError {
            message: format!("Sale item {} not found in sale #{}", item.sale_item_id, payload.original_sale_id),
        })?;

        let already   = returned_map.get(&item.sale_item_id).copied().unwrap_or(0.0);
        let remaining = orig_qty - already;
        if item.quantity > remaining + f64::EPSILON {
            return Err(AppError {
                message: format!(
                    "Cannot return {:.2} — only {:.2} remaining for item {}",
                    item.quantity, remaining, item.sale_item_id
                ),
            });
        }
        total_refund += (unit_price as f64 * item.quantity).round() as i64;
    }

    // Insert return header
    let return_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO sale_returns (original_sale_id, cashier_id, total_refund, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
    )
    .bind(payload.original_sale_id)
    .bind(payload.cashier_id)
    .bind(total_refund)
    .bind(payload.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    // Process each return item
    for item in &payload.items {
        let (unit_price, product_id): (i64, i64) = sqlx::query_as(
            "SELECT unit_price, product_id FROM sale_items WHERE id = $1",
        )
        .bind(item.sale_item_id)
        .fetch_one(&mut *tx)
        .await?;

        let refund_amount = (unit_price as f64 * item.quantity).round() as i64;

        sqlx::query(
            r#"
            INSERT INTO sale_return_items
                (return_id, sale_item_id, product_id, quantity, unit_price, refund_amount, is_resellable)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(return_id)
        .bind(item.sale_item_id)
        .bind(product_id)
        .bind(item.quantity)
        .bind(unit_price)
        .bind(refund_amount)
        .bind(item.is_resellable)
        .execute(&mut *tx)
        .await?;

        if item.is_resellable {
            sqlx::query(
                r#"
                INSERT INTO inventory_movements
                    (product_id, quantity_delta, movement_type, reference_id, created_by, notes)
                VALUES ($1, $2, 'return_in', $3, $4, $5)
                "#,
            )
            .bind(product_id)
            .bind(item.quantity)
            .bind(return_id)
            .bind(payload.cashier_id)
            .bind(format!("Return for sale #{}", payload.original_sale_id))
            .execute(&mut *tx)
            .await?;
        }
    }

    // If everything from the sale is now returned, mark it refunded
    let total_returned: f64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(sri.quantity), 0.0)
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.return_id
        WHERE sr.original_sale_id = $1
        "#,
    )
    .bind(payload.original_sale_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_sold: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(quantity), 0.0) FROM sale_items WHERE sale_id = $1",
    )
    .bind(payload.original_sale_id)
    .fetch_one(&mut *tx)
    .await?;

    if total_returned >= total_sold - f64::EPSILON {
        sqlx::query("UPDATE sales SET status = 'refunded' WHERE id = $1")
            .bind(payload.original_sale_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    let ret = sqlx::query_as::<_, SaleReturn>(
        "SELECT * FROM sale_returns WHERE id = $1",
    )
    .bind(return_id)
    .fetch_one(&state.db)
    .await?;

    let ret_items = sqlx::query_as::<_, SaleReturnItem>(
        "SELECT * FROM sale_return_items WHERE return_id = $1 ORDER BY id",
    )
    .bind(return_id)
    .fetch_all(&state.db)
    .await?;

    Ok(SaleReturnWithItems { return_header: ret, items: ret_items })
}

#[tauri::command]
pub async fn get_sale_return_items(
    state:   State<'_, AppState>,
    sale_id: i64,
) -> Result<Vec<SaleReturnItem>, AppError> {
    let items = sqlx::query_as::<_, SaleReturnItem>(
        r#"
        SELECT sri.*
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.return_id
        WHERE sr.original_sale_id = $1
        ORDER BY sri.id
        "#,
    )
    .bind(sale_id)
    .fetch_all(&state.db)
    .await?;
    Ok(items)
}
