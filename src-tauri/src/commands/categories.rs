use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{Category, CreateCategoryPayload},
};

#[tauri::command]
pub async fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, AppError> {
    let cats = sqlx::query_as::<_, Category>(
        "SELECT * FROM categories ORDER BY name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(cats)
}

#[tauri::command]
pub async fn create_category(
    state:   State<'_, AppState>,
    payload: CreateCategoryPayload,
) -> Result<Category, AppError> {
    let cat = sqlx::query_as::<_, Category>(
        "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
    )
    .bind(&payload.name)
    .bind(payload.description.as_deref())
    .fetch_one(&state.db)
    .await?;

    Ok(cat)
}

#[tauri::command]
pub async fn update_category(
    state:       State<'_, AppState>,
    id:          i64,
    name:        Option<String>,
    description: Option<String>,
) -> Result<Category, AppError> {
    let cat = sqlx::query_as::<_, Category>(
        r#"
        UPDATE categories SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description)
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(cat)
}

#[tauri::command]
pub async fn delete_category(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(())
}
