use tauri::State;

use crate::{db::AppState, error::AppError, models::CashSession};

#[tauri::command]
pub async fn open_cash_session(
    state:           State<'_, AppState>,
    cashier_id:      i64,
    opening_balance: i64,
    notes:           Option<String>,
) -> Result<CashSession, AppError> {
    // Reject if the cashier already has an open session
    let existing: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM cash_sessions WHERE cashier_id = $1 AND closed_at IS NULL",
    )
    .bind(cashier_id)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError {
            message: "Cashier already has an open session".into(),
        });
    }

    let session = sqlx::query_as::<_, CashSession>(
        r#"
        INSERT INTO cash_sessions (cashier_id, opening_balance, notes)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(cashier_id)
    .bind(opening_balance)
    .bind(notes.as_deref())
    .fetch_one(&state.db)
    .await?;

    Ok(session)
}

#[tauri::command]
pub async fn close_cash_session(
    state:           State<'_, AppState>,
    session_id:      i64,
    closing_balance: i64,
    notes:           Option<String>,
) -> Result<CashSession, AppError> {
    let session = sqlx::query_as::<_, CashSession>(
        r#"
        UPDATE cash_sessions
        SET closing_balance = $1,
            notes           = COALESCE($2, notes),
            closed_at       = NOW()
        WHERE id = $3 AND closed_at IS NULL
        RETURNING *
        "#,
    )
    .bind(closing_balance)
    .bind(notes.as_deref())
    .bind(session_id)
    .fetch_one(&state.db)
    .await?;

    Ok(session)
}

#[tauri::command]
pub async fn get_active_session(
    state:      State<'_, AppState>,
    cashier_id: i64,
) -> Result<Option<CashSession>, AppError> {
    let session = sqlx::query_as::<_, CashSession>(
        "SELECT * FROM cash_sessions WHERE cashier_id = $1 AND closed_at IS NULL",
    )
    .bind(cashier_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(session)
}

#[tauri::command]
pub async fn get_sessions(
    state:      State<'_, AppState>,
    cashier_id: Option<i64>,
    limit:      Option<i64>,
) -> Result<Vec<CashSession>, AppError> {
    let limit = limit.unwrap_or(20);

    let sessions = sqlx::query_as::<_, CashSession>(
        r#"
        SELECT * FROM cash_sessions
        WHERE ($1::BIGINT IS NULL OR cashier_id = $1)
        ORDER BY opened_at DESC
        LIMIT $2
        "#,
    )
    .bind(cashier_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(sessions)
}
