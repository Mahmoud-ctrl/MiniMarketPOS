use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreatePromotionPayload, Promotion},
};

#[tauri::command]
pub async fn get_promotions(state: State<'_, AppState>) -> Result<Vec<Promotion>, AppError> {
    let rows = sqlx::query_as::<_, Promotion>(
        "SELECT * FROM promotions ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn create_promotion(
    state:   State<'_, AppState>,
    payload: CreatePromotionPayload,
) -> Result<Promotion, AppError> {
    let row = sqlx::query_as::<_, Promotion>(
        r#"
        INSERT INTO promotions (name, product_id, buy_qty, get_qty)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(payload.product_id)
    .bind(payload.buy_qty)
    .bind(payload.get_qty)
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn toggle_promotion(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Promotion, AppError> {
    let row = sqlx::query_as::<_, Promotion>(
        "UPDATE promotions SET is_active = NOT is_active WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn delete_promotion(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM promotions WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(())
}
