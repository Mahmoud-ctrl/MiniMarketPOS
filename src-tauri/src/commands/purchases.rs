use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreatePurchasePayload, Purchase, PurchaseItemRow, PurchaseWithItems},
};

#[tauri::command]
pub async fn create_purchase(
    state:   State<'_, AppState>,
    payload: CreatePurchasePayload,
) -> Result<PurchaseWithItems, AppError> {
    if payload.items.is_empty() {
        return Err(AppError { message: "Purchase must have at least one item".into() });
    }

    let total_amount: i64 = payload.items.iter()
        .map(|i| (i.quantity * i.unit_cost as f64).round() as i64)
        .sum();

    let mut tx = state.db.begin().await?;

    let purchase_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO purchases
            (supplier_id, created_by, reference_no, total_amount, status, notes)
        VALUES ($1, $2, $3, $4, 'pending', $5)
        RETURNING id
        "#,
    )
    .bind(payload.supplier_id)
    .bind(payload.created_by)
    .bind(payload.reference_no.as_deref())
    .bind(total_amount)
    .bind(payload.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    let mut items: Vec<PurchaseItemRow> = Vec::new();
    for item in &payload.items {
        let subtotal = (item.quantity * item.unit_cost as f64).round() as i64;
        let row: PurchaseItemRow = sqlx::query_as(
            r#"
            INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id, purchase_id, product_id,
                (SELECT name FROM products WHERE id = $2) AS product_name,
                (SELECT unit FROM products WHERE id = $2) AS unit,
                quantity, unit_cost, subtotal
            "#,
        )
        .bind(purchase_id)
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(item.unit_cost)
        .bind(subtotal)
        .fetch_one(&mut *tx)
        .await?;
        items.push(row);
    }

    tx.commit().await?;

    let purchase = fetch_purchase(&state.db, purchase_id).await?;
    Ok(PurchaseWithItems { purchase, items })
}

#[tauri::command]
pub async fn get_purchases(
    state:       State<'_, AppState>,
    supplier_id: Option<i64>,
    status:      Option<String>,
    limit:       Option<i64>,
    offset:      Option<i64>,
) -> Result<Vec<Purchase>, AppError> {
    let rows = sqlx::query_as::<_, Purchase>(
        r#"
        SELECT
            p.id, p.supplier_id, p.created_by, p.received_by, p.reference_no,
            p.total_amount, p.status, p.notes, p.created_at, p.received_at,
            s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE ($1::BIGINT IS NULL OR p.supplier_id = $1)
          AND ($2::TEXT   IS NULL OR p.status      = $2)
        ORDER BY p.created_at DESC
        LIMIT  $3
        OFFSET $4
        "#,
    )
    .bind(supplier_id)
    .bind(status.as_deref())
    .bind(limit.unwrap_or(200))
    .bind(offset.unwrap_or(0))
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_purchase_by_id(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<PurchaseWithItems, AppError> {
    let purchase = fetch_purchase(&state.db, id).await?;

    let items: Vec<PurchaseItemRow> = sqlx::query_as(
        r#"
        SELECT
            pi.id, pi.purchase_id, pi.product_id,
            pr.name AS product_name, pr.unit,
            pi.quantity, pi.unit_cost, pi.subtotal
        FROM purchase_items pi
        JOIN products pr ON pr.id = pi.product_id
        WHERE pi.purchase_id = $1
        ORDER BY pi.id
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(PurchaseWithItems { purchase, items })
}

#[tauri::command]
pub async fn receive_purchase(
    state:       State<'_, AppState>,
    id:          i64,
    received_by: i64,
) -> Result<Purchase, AppError> {
    let mut tx = state.db.begin().await?;

    let current: String = sqlx::query_scalar("SELECT status FROM purchases WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError { message: format!("Purchase #{id} not found") })?;

    if current != "pending" {
        return Err(AppError {
            message: format!("Cannot receive a purchase with status '{current}'"),
        });
    }

    sqlx::query(
        "UPDATE purchases SET status='received', received_by=$1, received_at=NOW() WHERE id=$2",
    )
    .bind(received_by)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    let items: Vec<(i64, f64, i64)> = sqlx::query_as(
        "SELECT product_id, quantity, unit_cost FROM purchase_items WHERE purchase_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    for (product_id, quantity, unit_cost) in &items {
        sqlx::query(
            r#"
            INSERT INTO inventory_movements
                (product_id, quantity_delta, movement_type, reference_id, notes, created_by)
            VALUES ($1, $2, 'purchase', $3, $4, $5)
            "#,
        )
        .bind(product_id)
        .bind(quantity)
        .bind(id)
        .bind(format!("Purchase #{id} received"))
        .bind(received_by)
        .execute(&mut *tx)
        .await?;

        sqlx::query("UPDATE products SET cost_price=$1 WHERE id=$2")
            .bind(unit_cost)
            .bind(product_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    fetch_purchase(&state.db, id).await
}

#[tauri::command]
pub async fn cancel_purchase(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Purchase, AppError> {
    let current: String = sqlx::query_scalar("SELECT status FROM purchases WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError { message: format!("Purchase #{id} not found") })?;

    if current != "pending" {
        return Err(AppError {
            message: "Only pending purchase orders can be cancelled. Use void to reverse a received purchase.".into(),
        });
    }

    sqlx::query("UPDATE purchases SET status='cancelled' WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await?;

    fetch_purchase(&state.db, id).await
}

#[tauri::command]
pub async fn void_purchase(
    state:     State<'_, AppState>,
    id:        i64,
    voided_by: i64,
) -> Result<Purchase, AppError> {
    let mut tx = state.db.begin().await?;

    let current: String = sqlx::query_scalar("SELECT status FROM purchases WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError { message: format!("Purchase #{id} not found") })?;

    if current != "received" {
        return Err(AppError {
            message: format!("Cannot void a purchase with status '{current}'"),
        });
    }

    sqlx::query("UPDATE purchases SET status='cancelled' WHERE id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    let items: Vec<(i64, f64)> =
        sqlx::query_as("SELECT product_id, quantity FROM purchase_items WHERE purchase_id=$1")
            .bind(id)
            .fetch_all(&mut *tx)
            .await?;

    for (product_id, quantity) in &items {
        sqlx::query(
            r#"
            INSERT INTO inventory_movements
                (product_id, quantity_delta, movement_type, reference_id, notes, created_by)
            VALUES ($1, $2, 'return_out', $3, $4, $5)
            "#,
        )
        .bind(product_id)
        .bind(-quantity)
        .bind(id)
        .bind(format!("Void of purchase #{id}"))
        .bind(voided_by)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    fetch_purchase(&state.db, id).await
}

// ── Internal helper ───────────────────────────────────────────────────────────

async fn fetch_purchase(db: &sqlx::PgPool, id: i64) -> Result<Purchase, AppError> {
    sqlx::query_as::<_, Purchase>(
        r#"
        SELECT
            p.id, p.supplier_id, p.created_by, p.received_by, p.reference_no,
            p.total_amount, p.status, p.notes, p.created_at, p.received_at,
            s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError { message: format!("Purchase #{id} not found") })
}
