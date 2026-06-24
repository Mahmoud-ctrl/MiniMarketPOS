use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreateSupplierPayload, Supplier},
};

#[tauri::command]
pub async fn get_suppliers(state: State<'_, AppState>) -> Result<Vec<Supplier>, AppError> {
    let suppliers = sqlx::query_as::<_, Supplier>(
        "SELECT * FROM suppliers WHERE is_active = true ORDER BY name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(suppliers)
}

#[tauri::command]
pub async fn create_supplier(
    state:   State<'_, AppState>,
    payload: CreateSupplierPayload,
) -> Result<Supplier, AppError> {
    let supplier = sqlx::query_as::<_, Supplier>(
        "INSERT INTO suppliers (name, phone, email, address) VALUES ($1,$2,$3,$4) RETURNING *",
    )
    .bind(&payload.name)
    .bind(payload.phone.as_deref())
    .bind(payload.email.as_deref())
    .bind(payload.address.as_deref())
    .fetch_one(&state.db)
    .await?;

    Ok(supplier)
}

#[tauri::command]
pub async fn update_supplier(
    state:   State<'_, AppState>,
    id:      i64,
    name:    Option<String>,
    phone:   Option<String>,
    email:   Option<String>,
    address: Option<String>,
) -> Result<Supplier, AppError> {
    let supplier = sqlx::query_as::<_, Supplier>(
        r#"
        UPDATE suppliers SET
            name    = COALESCE($1, name),
            phone   = COALESCE($2, phone),
            email   = COALESCE($3, email),
            address = COALESCE($4, address)
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(phone)
    .bind(email)
    .bind(address)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(supplier)
}
