use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{Customer, CustomerLedgerEntry, CustomerWithBalance},
};

#[tauri::command]
pub async fn get_customers(state: State<'_, AppState>) -> Result<Vec<CustomerWithBalance>, AppError> {
    let rows = sqlx::query_as::<_, CustomerWithBalance>(
        r#"
        SELECT c.id, c.name, c.phone, c.email, c.notes, c.points, c.is_active, c.created_at,
               COALESCE(SUM(l.amount), 0)::BIGINT AS balance_due
        FROM customers c
        LEFT JOIN customer_ledger l ON l.customer_id = c.id
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.name, c.phone, c.email, c.notes, c.points, c.is_active, c.created_at
        ORDER BY c.name
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn search_customers(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Customer>, AppError> {
    let pattern = format!("%{}%", query.to_lowercase());
    let rows = sqlx::query_as::<_, Customer>(
        r#"
        SELECT id, name, phone, email, notes, points, is_active, created_at
        FROM customers
        WHERE is_active = TRUE AND (LOWER(name) LIKE $1 OR phone LIKE $1)
        ORDER BY name
        LIMIT 10
        "#,
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn create_customer(
    state: State<'_, AppState>,
    name:  String,
    phone: Option<String>,
    notes: Option<String>,
) -> Result<Customer, AppError> {
    if name.trim().is_empty() {
        return Err(AppError { message: "Customer name is required".into() });
    }
    let row = sqlx::query_as::<_, Customer>(
        r#"
        INSERT INTO customers (name, phone, notes)
        VALUES ($1, $2, $3)
        RETURNING id, name, phone, email, notes, points, is_active, created_at
        "#,
    )
    .bind(name.trim())
    .bind(phone.as_deref())
    .bind(notes.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn create_customer_quick(
    state: State<'_, AppState>,
    name:  String,
    phone: Option<String>,
) -> Result<Customer, AppError> {
    let phone_val = phone.filter(|p| !p.trim().is_empty());
    let row = sqlx::query_as::<_, Customer>(
        "INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id, name, phone, email, notes, points, is_active, created_at",
    )
    .bind(name.trim())
    .bind(phone_val.as_deref())
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn update_customer(
    state: State<'_, AppState>,
    id:    i64,
    name:  String,
    phone: Option<String>,
    email: Option<String>,
    notes: Option<String>,
) -> Result<Customer, AppError> {
    let phone_val = phone.filter(|p| !p.trim().is_empty());
    let email_val = email.filter(|e| !e.trim().is_empty());
    let notes_val = notes.filter(|n| !n.trim().is_empty());
    let row = sqlx::query_as::<_, Customer>(
        r#"UPDATE customers
           SET name = $1, phone = $2, email = $3, notes = $4
           WHERE id = $5
           RETURNING id, name, phone, email, notes, points, is_active, created_at"#,
    )
    .bind(name.trim())
    .bind(phone_val.as_deref())
    .bind(email_val.as_deref())
    .bind(notes_val.as_deref())
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn deactivate_customer(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Customer, AppError> {
    let row = sqlx::query_as::<_, Customer>(
        "UPDATE customers SET is_active = false WHERE id = $1 RETURNING id, name, phone, email, notes, points, is_active, created_at",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

#[tauri::command]
pub async fn get_customer_ledger(
    state:       State<'_, AppState>,
    customer_id: i64,
) -> Result<Vec<CustomerLedgerEntry>, AppError> {
    let rows = sqlx::query_as::<_, CustomerLedgerEntry>(
        r#"
        SELECT id, customer_id, amount, entry_type, sale_id, notes, created_by, created_at
        FROM customer_ledger
        WHERE customer_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(customer_id)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn record_customer_payment(
    state:       State<'_, AppState>,
    customer_id: i64,
    amount:      i64,
    sale_id:     Option<i64>,
    notes:       Option<String>,
    created_by:  i64,
) -> Result<CustomerWithBalance, AppError> {
    if amount <= 0 {
        return Err(AppError { message: "Payment amount must be positive".into() });
    }

    // Verify customer exists
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1)")
        .bind(customer_id)
        .fetch_one(&state.db)
        .await?;
    if !exists {
        return Err(AppError { message: format!("Customer #{customer_id} not found") });
    }

    // Payments are stored as negative amounts (reduce the balance)
    sqlx::query(
        r#"
        INSERT INTO customer_ledger (customer_id, sale_id, amount, entry_type, notes, created_by)
        VALUES ($1, $2, $3, 'payment', $4, $5)
        "#,
    )
    .bind(customer_id)
    .bind(sale_id)
    .bind(-amount)
    .bind(notes.as_deref())
    .bind(created_by)
    .execute(&state.db)
    .await?;

    // If a specific sale was referenced and its ledger balance is now fully cleared,
    // mark that sale as completed
    if let Some(sid) = sale_id {
        let sale_balance: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0) FROM customer_ledger WHERE sale_id = $1",
        )
        .bind(sid)
        .fetch_one(&state.db)
        .await?;

        if sale_balance <= 0 {
            sqlx::query(
                "UPDATE sales SET status = 'completed' WHERE id = $1 AND status = 'pending'",
            )
            .bind(sid)
            .execute(&state.db)
            .await?;
        }
    }

    // Return updated balance
    let updated = sqlx::query_as::<_, CustomerWithBalance>(
        r#"
        SELECT c.id, c.name, c.phone, c.email, c.notes, c.points, c.is_active, c.created_at,
               COALESCE(SUM(l.amount), 0)::BIGINT AS balance_due
        FROM customers c
        LEFT JOIN customer_ledger l ON l.customer_id = c.id
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.phone, c.email, c.notes, c.points, c.is_active, c.created_at
        "#,
    )
    .bind(customer_id)
    .fetch_one(&state.db)
    .await?;

    Ok(updated)
}
