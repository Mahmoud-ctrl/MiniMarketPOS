use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{Category, CreateCategoryPayload},
};

#[tauri::command]
pub async fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, AppError> {
    let cats = sqlx::query_as::<_, Category>(
        "SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name",
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
    if let Some(pid) = payload.parent_id {
        // Enforce max 2 levels: the chosen parent must itself be a root category.
        let parent_is_root: bool = sqlx::query_scalar(
            "SELECT parent_id IS NULL FROM categories WHERE id = $1",
        )
        .bind(pid)
        .fetch_optional(&state.db)
        .await?
        .unwrap_or(false);

        if !parent_is_root {
            return Err(AppError { message: "Parent must be a top-level category (max 2 levels)".into() });
        }
    }

    let cat = sqlx::query_as::<_, Category>(
        "INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(&payload.name)
    .bind(payload.description.as_deref())
    .bind(payload.parent_id)
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
    parent_id:   Option<i64>,
) -> Result<Category, AppError> {
    if let Some(pid) = parent_id {
        if pid == id {
            return Err(AppError { message: "A category cannot be its own parent".into() });
        }
        let parent_is_root: bool = sqlx::query_scalar(
            "SELECT parent_id IS NULL FROM categories WHERE id = $1",
        )
        .bind(pid)
        .fetch_optional(&state.db)
        .await?
        .unwrap_or(false);

        if !parent_is_root {
            return Err(AppError { message: "Parent must be a top-level category (max 2 levels)".into() });
        }
    }

    let cat = sqlx::query_as::<_, Category>(
        r#"
        UPDATE categories SET
            name        = COALESCE($1, name),
            description = $2,
            parent_id   = $3
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(parent_id)
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
