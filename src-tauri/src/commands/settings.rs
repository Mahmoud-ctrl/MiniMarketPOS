use tauri::State;

use crate::{db::AppState, error::AppError, models::Setting};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    let rows = sqlx::query_as::<_, Setting>(
        "SELECT * FROM settings ORDER BY key",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn update_setting(
    state: State<'_, AppState>,
    key:   String,
    value: String,
) -> Result<Setting, AppError> {
    let row = sqlx::query_as::<_, Setting>(
        r#"
        INSERT INTO settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(&key)
    .bind(&value)
    .fetch_one(&state.db)
    .await?;

    Ok(row)
}
