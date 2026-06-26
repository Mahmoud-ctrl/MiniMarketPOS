use chrono::Utc;
use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{AdjustInventoryPayload, LogWastePayload, PerishableAlert, ProductStock},
};

/// Record incoming stock from a supplier purchase.
#[tauri::command]
pub async fn receive_stock(
    state:      State<'_, AppState>,
    product_id: i64,
    quantity:   f64,
    notes:      Option<String>,
    created_by: i64,
) -> Result<(), AppError> {
    if quantity <= 0.0 {
        return Err(AppError { message: "Quantity must be positive".into() });
    }
    sqlx::query(
        r#"
        INSERT INTO inventory_movements
            (product_id, quantity_delta, movement_type, notes, created_by)
        VALUES ($1, $2, 'purchase', $3, $4)
        "#,
    )
    .bind(product_id)
    .bind(quantity)
    .bind(notes.as_deref())
    .bind(created_by)
    .execute(&state.db)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn get_product_stock(
    state:      State<'_, AppState>,
    product_id: Option<i64>,
) -> Result<Vec<ProductStock>, AppError> {
    let rows = sqlx::query_as::<_, ProductStock>(
        r#"
        SELECT * FROM v_product_stock
        WHERE is_active = true
          AND ($1::BIGINT IS NULL OR product_id = $1)
        ORDER BY name
        "#,
    )
    .bind(product_id)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_low_stock(state: State<'_, AppState>) -> Result<Vec<ProductStock>, AppError> {
    let rows = sqlx::query_as::<_, ProductStock>(
        "SELECT * FROM v_product_stock WHERE is_active = true AND low_stock_flag = true ORDER BY stock_qty ASC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Returns all perishable products that currently have stock.
#[tauri::command]
pub async fn get_perishable_alerts(
    state: State<'_, AppState>,
) -> Result<Vec<PerishableAlert>, AppError> {
    let rows = sqlx::query_as::<_, PerishableAlert>(
        "SELECT * FROM v_perishable_alerts ORDER BY days_until_expiry ASC NULLS LAST, name ASC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Log produce/perishable waste. Removes stock and updates the self-learned shelf life.
#[tauri::command]
pub async fn log_waste(
    state:   State<'_, AppState>,
    payload: LogWastePayload,
) -> Result<(), AppError> {
    if payload.quantity <= 0.0 {
        return Err(AppError { message: "Quantity must be positive".into() });
    }

    // Deduct stock as a negative waste movement
    sqlx::query(
        r#"
        INSERT INTO inventory_movements
            (product_id, quantity_delta, movement_type, notes, created_by)
        VALUES ($1, $2, 'waste', $3, $4)
        "#,
    )
    .bind(payload.product_id)
    .bind(-payload.quantity)
    .bind(payload.notes.as_deref())
    .bind(payload.created_by)
    .execute(&state.db)
    .await?;

    // Self-learning: find the most recent positive receipt before now
    let last_received: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
        r#"
        SELECT MAX(created_at)
        FROM inventory_movements
        WHERE product_id     = $1
          AND quantity_delta > 0
          AND movement_type IN ('purchase', 'opening', 'adjustment', 'return_in')
        "#,
    )
    .bind(payload.product_id)
    .fetch_one(&state.db)
    .await?;

    if let Some(received_at) = last_received {
        let days_survived = (Utc::now() - received_at).num_days().max(0) as i32;

        let current_life: Option<i32> = sqlx::query_scalar(
            "SELECT default_shelf_life_days FROM products WHERE id = $1",
        )
        .bind(payload.product_id)
        .fetch_one(&state.db)
        .await?;

        // Weighted average — first observation sets the baseline directly
        let new_life = match current_life {
            None    => days_survived,
            Some(c) => ((c as f64 * 0.7) + (days_survived as f64 * 0.3)).round() as i32,
        };

        sqlx::query("UPDATE products SET default_shelf_life_days = $1 WHERE id = $2")
            .bind(new_life)
            .bind(payload.product_id)
            .execute(&state.db)
            .await?;
    }

    Ok(())
}

/// Manual stock adjustment (recount, shrinkage, damage, opening stock, etc.)
#[tauri::command]
pub async fn adjust_inventory(
    state:   State<'_, AppState>,
    payload: AdjustInventoryPayload,
) -> Result<(), AppError> {
    let allowed = ["opening", "adjustment", "damage", "return_in", "return_out"];
    if !allowed.contains(&payload.movement_type.as_str()) {
        return Err(AppError {
            message: format!(
                "movement_type must be one of: {}",
                allowed.join(", ")
            ),
        });
    }

    sqlx::query(
        r#"
        INSERT INTO inventory_movements
            (product_id, quantity_delta, movement_type, notes, created_by)
        VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(payload.product_id)
    .bind(payload.quantity_delta)
    .bind(&payload.movement_type)
    .bind(payload.notes.as_deref())
    .bind(payload.created_by)
    .execute(&state.db)
    .await?;

    Ok(())
}
