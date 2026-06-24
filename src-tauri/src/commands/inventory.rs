use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{AdjustInventoryPayload, ProductStock},
};

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
