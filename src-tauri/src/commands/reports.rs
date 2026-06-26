use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{
        CashierStatsRow, DailySalesRow, DailyWasteRow, SalesSummary,
        TopCustomerRow, TopProductRow, TopWasterRow, WasteSummary,
    },
};

#[tauri::command]
pub async fn get_sales_summary(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
) -> Result<SalesSummary, AppError> {
    let row = sqlx::query_as::<_, SalesSummary>(
        r#"
        SELECT
            COALESCE(SUM(total_amount), 0)::BIGINT                                                       AS total_revenue,
            COUNT(*)::BIGINT                                                                              AS transaction_count,
            COALESCE((SUM(total_amount)::FLOAT8 / NULLIF(COUNT(*), 0))::BIGINT, 0)                       AS average_order,
            COALESCE(SUM(discount), 0)::BIGINT                                                            AS total_discount,
            COALESCE(SUM(tax), 0)::BIGINT                                                                 AS total_tax,
            COALESCE(SUM(CASE WHEN payment_method = 'cash'   THEN amount_paid ELSE 0 END), 0)::BIGINT    AS cash_collected,
            COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN amount_paid ELSE 0 END), 0)::BIGINT    AS credit_collected,
            COALESCE(SUM(GREATEST(0, total_amount - amount_paid)), 0)::BIGINT                             AS debt_added
        FROM sales
        WHERE status IN ('completed', 'pending')
          AND ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ)
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&state.db)
    .await?;

    Ok(row)
}

#[tauri::command]
pub async fn get_daily_sales(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
) -> Result<Vec<DailySalesRow>, AppError> {
    let rows = sqlx::query_as::<_, DailySalesRow>(
        r#"
        SELECT
            TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(total_amount), 0)::BIGINT AS revenue,
            COUNT(*)::BIGINT AS transactions
        FROM sales
        WHERE status IN ('completed', 'pending')
          AND ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ)
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY 1 ASC
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_top_products(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
    limit:     Option<i64>,
) -> Result<Vec<TopProductRow>, AppError> {
    let rows = sqlx::query_as::<_, TopProductRow>(
        r#"
        SELECT
            si.product_id,
            p.name                              AS product_name,
            COALESCE(SUM(si.quantity), 0)       AS quantity_sold,
            COALESCE(SUM(si.subtotal), 0)::BIGINT AS revenue,
            COUNT(DISTINCT si.sale_id)::BIGINT  AS transaction_count
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN sales    s ON s.id = si.sale_id
        WHERE s.status IN ('completed', 'pending')
          AND ($1::TIMESTAMPTZ IS NULL OR s.created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR s.created_at <= $2::TIMESTAMPTZ)
        GROUP BY si.product_id, p.name
        ORDER BY revenue DESC
        LIMIT $3
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit.unwrap_or(10))
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_top_customers(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
    limit:     Option<i64>,
) -> Result<Vec<TopCustomerRow>, AppError> {
    let rows = sqlx::query_as::<_, TopCustomerRow>(
        r#"
        SELECT
            c.id                                        AS customer_id,
            c.name                                      AS customer_name,
            COALESCE(SUM(s.total_amount), 0)::BIGINT   AS total_spent,
            COUNT(s.id)::BIGINT                         AS visit_count,
            COALESCE(
                (SELECT SUM(l.amount) FROM customer_ledger l WHERE l.customer_id = c.id),
                0
            )::BIGINT AS balance_due
        FROM customers c
        JOIN sales s ON s.customer_id = c.id
            AND s.status IN ('completed', 'pending')
            AND ($1::TIMESTAMPTZ IS NULL OR s.created_at >= $1::TIMESTAMPTZ)
            AND ($2::TIMESTAMPTZ IS NULL OR s.created_at <= $2::TIMESTAMPTZ)
        WHERE c.is_active = true
        GROUP BY c.id, c.name
        ORDER BY total_spent DESC
        LIMIT $3
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit.unwrap_or(10))
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Total waste loss, event count, and quantity for the period.
#[tauri::command]
pub async fn get_waste_summary(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
) -> Result<WasteSummary, AppError> {
    let row = sqlx::query_as::<_, WasteSummary>(
        r#"
        SELECT
            COALESCE(SUM(ABS(m.quantity_delta) * p.cost_price), 0)::BIGINT AS total_waste_value,
            COUNT(*)::BIGINT                                                  AS total_waste_events,
            COALESCE(SUM(ABS(m.quantity_delta)), 0.0)                        AS total_waste_qty
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        WHERE m.movement_type = 'waste'
          AND ($1::TIMESTAMPTZ IS NULL OR m.created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR m.created_at <= $2::TIMESTAMPTZ)
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_one(&state.db)
    .await?;

    Ok(row)
}

/// Products ranked by waste value (qty × cost_price) descending.
#[tauri::command]
pub async fn get_top_wasters(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
    limit:     Option<i64>,
) -> Result<Vec<TopWasterRow>, AppError> {
    let rows = sqlx::query_as::<_, TopWasterRow>(
        r#"
        SELECT
            p.id                                                              AS product_id,
            p.name                                                            AS product_name,
            p.unit,
            SUM(ABS(m.quantity_delta))                                        AS waste_qty,
            SUM(ABS(m.quantity_delta) * p.cost_price)::BIGINT                AS waste_value,
            COUNT(*)::BIGINT                                                  AS waste_events
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        WHERE m.movement_type = 'waste'
          AND ($1::TIMESTAMPTZ IS NULL OR m.created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR m.created_at <= $2::TIMESTAMPTZ)
        GROUP BY p.id, p.name, p.unit
        ORDER BY waste_value DESC
        LIMIT $3
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .bind(limit.unwrap_or(10))
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

/// Daily waste aggregates for the bar chart.
#[tauri::command]
pub async fn get_daily_waste(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
) -> Result<Vec<DailyWasteRow>, AppError> {
    let rows = sqlx::query_as::<_, DailyWasteRow>(
        r#"
        SELECT
            TO_CHAR(m.created_at, 'YYYY-MM-DD')              AS date,
            SUM(ABS(m.quantity_delta) * p.cost_price)::BIGINT AS waste_value,
            SUM(ABS(m.quantity_delta))                         AS waste_qty,
            COUNT(*)::BIGINT                                   AS waste_events
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        WHERE m.movement_type = 'waste'
          AND ($1::TIMESTAMPTZ IS NULL OR m.created_at >= $1::TIMESTAMPTZ)
          AND ($2::TIMESTAMPTZ IS NULL OR m.created_at <= $2::TIMESTAMPTZ)
        GROUP BY TO_CHAR(m.created_at, 'YYYY-MM-DD')
        ORDER BY 1 ASC
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_cashier_stats(
    state:     State<'_, AppState>,
    date_from: Option<String>,
    date_to:   Option<String>,
) -> Result<Vec<CashierStatsRow>, AppError> {
    let rows = sqlx::query_as::<_, CashierStatsRow>(
        r#"
        SELECT
            u.id                                                                                AS cashier_id,
            u.full_name                                                                         AS cashier_name,
            COALESCE(SUM(s.total_amount), 0)::BIGINT                                           AS total_sales,
            COUNT(s.id)::BIGINT                                                                 AS transaction_count,
            COALESCE((SUM(s.total_amount)::FLOAT8 / NULLIF(COUNT(s.id), 0))::BIGINT, 0)        AS average_order
        FROM users u
        JOIN sales s ON s.cashier_id = u.id
            AND s.status IN ('completed', 'pending')
            AND ($1::TIMESTAMPTZ IS NULL OR s.created_at >= $1::TIMESTAMPTZ)
            AND ($2::TIMESTAMPTZ IS NULL OR s.created_at <= $2::TIMESTAMPTZ)
        WHERE u.is_active = true
        GROUP BY u.id, u.full_name
        ORDER BY total_sales DESC
        "#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    Ok(rows)
}
