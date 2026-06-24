use chrono::{DateTime, Utc};
use sqlx::FromRow;
use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{LoginPayload, LoginResult, User},
};

// Internal row — includes pin_hash which we never expose to the frontend
#[derive(Debug, FromRow)]
struct UserRow {
    pub id:         i64,
    pub username:   String,
    pub pin_hash:   String,
    pub full_name:  String,
    pub role:       String,
    pub is_active:  bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Verify a user's PIN and return their profile (without pin_hash).
/// PIN comparison is plain-text for now — replace with Argon2 verify when ready.
#[tauri::command]
pub async fn login(
    state:   State<'_, AppState>,
    payload: LoginPayload,
) -> Result<LoginResult, AppError> {
    let row = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, username, pin_hash, full_name, role, is_active, created_at, updated_at
        FROM users
        WHERE username = $1 AND is_active = true
        "#,
    )
    .bind(&payload.username)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| AppError {
        message: "Invalid username or PIN".into(),
    })?;

    // TODO: replace with argon2::verify_encoded(&row.pin_hash, payload.pin.as_bytes())
    if row.pin_hash != payload.pin {
        return Err(AppError {
            message: "Invalid username or PIN".into(),
        });
    }

    let user = User {
        id:         row.id,
        username:   row.username,
        full_name:  row.full_name,
        role:       row.role,
        is_active:  row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(LoginResult { user })
}

/// Update a user's PIN. New PIN must be 4–6 digits.
#[tauri::command]
pub async fn set_pin(
    state:   State<'_, AppState>,
    user_id: i64,
    new_pin: String,
) -> Result<(), AppError> {
    validate_pin(&new_pin)?;

    // TODO: hash with Argon2 before storing
    sqlx::query("UPDATE users SET pin_hash = $1 WHERE id = $2")
        .bind(&new_pin)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(())
}

/// Create a new user (admin only — enforce in the frontend).
#[tauri::command]
pub async fn create_user(
    state:     State<'_, AppState>,
    username:  String,
    full_name: String,
    role:      String,
    pin:       String,
) -> Result<User, AppError> {
    validate_pin(&pin)?;

    // TODO: hash with Argon2 before storing
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (username, pin_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, full_name, role, is_active, created_at, updated_at
        "#,
    )
    .bind(&username)
    .bind(&pin)
    .bind(&full_name)
    .bind(&role)
    .fetch_one(&state.db)
    .await?;

    Ok(user)
}

/// List all users — pin_hash is never selected.
#[tauri::command]
pub async fn get_users(state: State<'_, AppState>) -> Result<Vec<User>, AppError> {
    let users = sqlx::query_as::<_, User>(
        "SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users ORDER BY full_name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(users)
}

fn validate_pin(pin: &str) -> Result<(), AppError> {
    if pin.len() < 4 || pin.len() > 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError { message: "PIN must be 4–6 digits".into() });
    }
    Ok(())
}
