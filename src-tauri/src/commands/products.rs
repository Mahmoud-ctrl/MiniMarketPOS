use chrono::NaiveDate;
use tauri::State;

use crate::{
    db::AppState,
    error::AppError,
    models::{CreateProductPayload, PriceHistoryEntry, Product, UpdateProductPayload},
};

#[derive(sqlx::FromRow)]
struct PriceSnapshot {
    cost_price:           i64,
    sell_price_retail:    i64,
    sell_price_wholesale: i64,
    sell_price_special:   i64,
}

#[tauri::command]
pub async fn get_products(
    state:          State<'_, AppState>,
    search:         Option<String>,
    category_id:    Option<i64>,
    supplier_id:    Option<i64>,
    favorites_only: Option<bool>,
    limit:          Option<i64>,
    offset:         Option<i64>,
) -> Result<Vec<Product>, AppError> {
    let limit  = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);

    let products = sqlx::query_as::<_, Product>(
        r#"
        SELECT * FROM products
        WHERE is_active = true
          AND ($1::TEXT IS NULL OR name ILIKE '%' || $1 || '%' OR barcode = $1 OR internal_code = $1)
          AND ($2::BIGINT IS NULL OR category_id = $2)
          AND ($3::BIGINT IS NULL OR supplier_id = $3)
          AND ($4::BOOLEAN IS NULL OR ($4 = true AND is_favorite = true))
        ORDER BY name
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(search)
    .bind(category_id)
    .bind(supplier_id)
    .bind(favorites_only)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(products)
}

/// Fast barcode lookup — the primary POS scan path.
#[tauri::command]
pub async fn get_product_by_barcode(
    state:   State<'_, AppState>,
    barcode: String,
) -> Result<Option<Product>, AppError> {
    let product = sqlx::query_as::<_, Product>(
        "SELECT * FROM products WHERE barcode = $1 AND is_active = true AND is_frozen = false",
    )
    .bind(&barcode)
    .fetch_optional(&state.db)
    .await?;

    Ok(product)
}

#[tauri::command]
pub async fn get_product_by_id(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Option<Product>, AppError> {
    let product = sqlx::query_as::<_, Product>("SELECT * FROM products WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;

    Ok(product)
}

#[tauri::command]
pub async fn create_product(
    state:   State<'_, AppState>,
    payload: CreateProductPayload,
) -> Result<Product, AppError> {
    let expiry = parse_expiry(payload.expiry_date.as_deref())?;

    let product = sqlx::query_as::<_, Product>(
        r#"
        INSERT INTO products (
            barcode, internal_code, name, category_id, supplier_id,
            item_type, unit, packaging_qty,
            cost_price, sell_price_retail, sell_price_wholesale, sell_price_special,
            tva_rate, apply_tva, apply_discount, sold_by_amount,
            min_stock, expiry_date, is_perishable, default_shelf_life_days,
            is_variable_price, is_favorite
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING *
        "#,
    )
    .bind(payload.barcode)
    .bind(payload.internal_code)
    .bind(&payload.name)
    .bind(payload.category_id)
    .bind(payload.supplier_id)
    .bind(payload.item_type.unwrap_or_else(|| "consumable".into()))
    .bind(payload.unit.unwrap_or_else(|| "pcs".into()))
    .bind(payload.packaging_qty.unwrap_or(1))
    .bind(payload.cost_price)
    .bind(payload.sell_price_retail)
    .bind(payload.sell_price_wholesale.unwrap_or(0))
    .bind(payload.sell_price_special.unwrap_or(0))
    .bind(payload.tva_rate.unwrap_or(0.0))
    .bind(payload.apply_tva.unwrap_or(false))
    .bind(payload.apply_discount.unwrap_or(true))
    .bind(payload.sold_by_amount.unwrap_or(false))
    .bind(payload.min_stock.unwrap_or(0.0))
    .bind(expiry)
    .bind(payload.is_perishable.unwrap_or(false))
    .bind(payload.default_shelf_life_days)
    .bind(payload.is_variable_price.unwrap_or(false))
    .bind(payload.is_favorite.unwrap_or(false))
    .fetch_one(&state.db)
    .await?;

    Ok(product)
}

/// Partial update — only fields present in the payload are changed.
/// Uses COALESCE so omitted fields keep their current value.
/// Logs price-field changes to `price_history` inside the same transaction.
#[tauri::command]
pub async fn update_product(
    state:      State<'_, AppState>,
    id:         i64,
    payload:    UpdateProductPayload,
    changed_by: Option<i64>,
) -> Result<Product, AppError> {
    let expiry = parse_expiry(payload.expiry_date.as_deref())?;
    let mut tx = state.db.begin().await?;

    // Snapshot prices before change for history comparison
    let snapshot = sqlx::query_as::<_, PriceSnapshot>(
        "SELECT cost_price, sell_price_retail, sell_price_wholesale, sell_price_special \
         FROM products WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    let product = sqlx::query_as::<_, Product>(
        r#"
        UPDATE products SET
            barcode                = COALESCE($1,  barcode),
            internal_code          = COALESCE($2,  internal_code),
            name                   = COALESCE($3,  name),
            category_id            = COALESCE($4,  category_id),
            supplier_id            = COALESCE($5,  supplier_id),
            item_type              = COALESCE($6,  item_type),
            unit                   = COALESCE($7,  unit),
            packaging_qty          = COALESCE($8,  packaging_qty),
            cost_price             = COALESCE($9,  cost_price),
            sell_price_retail      = COALESCE($10, sell_price_retail),
            sell_price_wholesale   = COALESCE($11, sell_price_wholesale),
            sell_price_special     = COALESCE($12, sell_price_special),
            tva_rate               = COALESCE($13, tva_rate),
            apply_tva              = COALESCE($14, apply_tva),
            apply_discount         = COALESCE($15, apply_discount),
            sold_by_amount         = COALESCE($16, sold_by_amount),
            min_stock              = COALESCE($17, min_stock),
            expiry_date            = COALESCE($18, expiry_date),
            is_perishable           = COALESCE($20, is_perishable),
            default_shelf_life_days = COALESCE($21, default_shelf_life_days),
            is_variable_price       = COALESCE($22, is_variable_price),
            is_favorite             = COALESCE($23, is_favorite)
        WHERE id = $19
        RETURNING *
        "#,
    )
    .bind(payload.barcode)
    .bind(payload.internal_code)
    .bind(payload.name)
    .bind(payload.category_id)
    .bind(payload.supplier_id)
    .bind(payload.item_type)
    .bind(payload.unit)
    .bind(payload.packaging_qty)
    .bind(payload.cost_price)
    .bind(payload.sell_price_retail)
    .bind(payload.sell_price_wholesale)
    .bind(payload.sell_price_special)
    .bind(payload.tva_rate)
    .bind(payload.apply_tva)
    .bind(payload.apply_discount)
    .bind(payload.sold_by_amount)
    .bind(payload.min_stock)
    .bind(expiry)
    .bind(id)
    .bind(payload.is_perishable)
    .bind(payload.default_shelf_life_days)
    .bind(payload.is_variable_price)
    .bind(payload.is_favorite)
    .fetch_one(&mut *tx)
    .await?;

    // Insert a history row for each price field that changed
    if let Some(snap) = snapshot {
        let price_fields: &[(&str, i64, i64)] = &[
            ("cost_price",           snap.cost_price,           product.cost_price),
            ("sell_price_retail",    snap.sell_price_retail,    product.sell_price_retail),
            ("sell_price_wholesale", snap.sell_price_wholesale, product.sell_price_wholesale),
            ("sell_price_special",   snap.sell_price_special,   product.sell_price_special),
        ];
        for &(field_name, old_val, new_val) in price_fields {
            if old_val != new_val {
                sqlx::query(
                    "INSERT INTO price_history \
                     (product_id, changed_by, field_name, old_value, new_value) \
                     VALUES ($1, $2, $3, $4, $5)",
                )
                .bind(id)
                .bind(changed_by)
                .bind(field_name)
                .bind(old_val)
                .bind(new_val)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    tx.commit().await?;
    Ok(product)
}

#[tauri::command]
pub async fn get_price_history(
    state:      State<'_, AppState>,
    product_id: i64,
    limit:      Option<i64>,
) -> Result<Vec<PriceHistoryEntry>, AppError> {
    let limit = limit.unwrap_or(50);
    sqlx::query_as::<_, PriceHistoryEntry>(
        r#"
        SELECT
            ph.id, ph.product_id, ph.changed_by, ph.changed_at,
            ph.field_name, ph.old_value, ph.new_value,
            u.full_name AS changed_by_name
        FROM price_history ph
        LEFT JOIN users u ON u.id = ph.changed_by
        WHERE ph.product_id = $1
        ORDER BY ph.changed_at DESC
        LIMIT $2
        "#,
    )
    .bind(product_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn toggle_product_frozen(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Product, AppError> {
    let product = sqlx::query_as::<_, Product>(
        "UPDATE products SET is_frozen = NOT is_frozen WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(product)
}

#[tauri::command]
pub async fn deactivate_product(
    state: State<'_, AppState>,
    id:    i64,
) -> Result<Product, AppError> {
    let product = sqlx::query_as::<_, Product>(
        "UPDATE products SET is_active = false WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(product)
}

fn parse_expiry(s: Option<&str>) -> Result<Option<NaiveDate>, AppError> {
    match s {
        None => Ok(None),
        Some(d) => NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .map(Some)
            .map_err(|e| AppError { message: format!("Invalid expiry date: {e}") }),
    }
}
