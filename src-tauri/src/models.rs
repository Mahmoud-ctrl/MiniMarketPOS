use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Users ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct User {
    pub id:         i64,
    pub username:   String,
    pub full_name:  String,
    pub role:       String,
    pub is_active:  bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Categories ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Category {
    pub id:          i64,
    pub name:        String,
    pub description: Option<String>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryPayload {
    pub name:        String,
    pub description: Option<String>,
}

// ── Suppliers ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Supplier {
    pub id:         i64,
    pub name:       String,
    pub phone:      Option<String>,
    pub email:      Option<String>,
    pub address:    Option<String>,
    pub is_active:  bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplierPayload {
    pub name:    String,
    pub phone:   Option<String>,
    pub email:   Option<String>,
    pub address: Option<String>,
}

// ── Products ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Product {
    pub id:                   i64,
    pub barcode:              Option<String>,
    pub internal_code:        Option<String>,
    pub name:                 String,
    pub category_id:          Option<i64>,
    pub supplier_id:          Option<i64>,
    pub item_type:            String,
    pub unit:                 String,
    pub packaging_qty:        i32,
    pub cost_price:           i64,
    pub sell_price_retail:    i64,
    pub sell_price_wholesale: i64,
    pub sell_price_special:   i64,
    pub tva_rate:             f64,
    pub apply_tva:            bool,
    pub apply_discount:       bool,
    pub sold_by_amount:       bool,
    pub min_stock:            f64,
    pub expiry_date:          Option<NaiveDate>,
    pub is_active:            bool,
    pub is_frozen:            bool,
    pub created_at:           DateTime<Utc>,
    pub updated_at:           DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub barcode:              Option<String>,
    pub internal_code:        Option<String>,
    pub name:                 String,
    pub category_id:          Option<i64>,
    pub supplier_id:          Option<i64>,
    pub item_type:            Option<String>,
    pub unit:                 Option<String>,
    pub packaging_qty:        Option<i32>,
    pub cost_price:           i64,
    pub sell_price_retail:    i64,
    pub sell_price_wholesale: Option<i64>,
    pub sell_price_special:   Option<i64>,
    pub tva_rate:             Option<f64>,
    pub apply_tva:            Option<bool>,
    pub apply_discount:       Option<bool>,
    pub sold_by_amount:       Option<bool>,
    pub min_stock:            Option<f64>,
    pub expiry_date:          Option<String>, // "YYYY-MM-DD"
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub barcode:              Option<String>,
    pub internal_code:        Option<String>,
    pub name:                 Option<String>,
    pub category_id:          Option<i64>,
    pub supplier_id:          Option<i64>,
    pub item_type:            Option<String>,
    pub unit:                 Option<String>,
    pub packaging_qty:        Option<i32>,
    pub cost_price:           Option<i64>,
    pub sell_price_retail:    Option<i64>,
    pub sell_price_wholesale: Option<i64>,
    pub sell_price_special:   Option<i64>,
    pub tva_rate:             Option<f64>,
    pub apply_tva:            Option<bool>,
    pub apply_discount:       Option<bool>,
    pub sold_by_amount:       Option<bool>,
    pub min_stock:            Option<f64>,
    pub expiry_date:          Option<String>,
}

// ── Customers ────────────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Debug, Serialize, FromRow)]
pub struct Customer {
    pub id:         i64,
    pub name:       String,
    pub phone:      Option<String>,
    pub email:      Option<String>,
    pub points:     i64,
    pub is_active:  bool,
    pub created_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct CreateCustomerPayload {
    pub name:  String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

// ── Cash Sessions ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct CashSession {
    pub id:              i64,
    pub cashier_id:      i64,
    pub opening_balance: i64,
    pub closing_balance: Option<i64>,
    pub notes:           Option<String>,
    pub opened_at:       DateTime<Utc>,
    pub closed_at:       Option<DateTime<Utc>>,
}

// ── Sales ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Sale {
    pub id:             i64,
    pub session_id:     Option<i64>,
    pub cashier_id:     i64,
    pub customer_id:    Option<i64>,
    pub subtotal:       i64,
    pub discount:       i64,
    pub tax:            i64,
    pub total_amount:   i64,
    pub amount_paid:    i64,
    pub change_given:   i64,
    pub payment_method: String,
    pub status:         String,
    pub notes:          Option<String>,
    pub created_at:     DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SaleItem {
    pub id:         i64,
    pub sale_id:    i64,
    pub product_id: i64,
    pub quantity:   f64,
    pub unit_price: i64,
    pub unit_cost:  i64,
    pub price_tier: String,
    pub discount:   i64,
    pub tva_amount: i64,
    pub subtotal:   i64,
}

#[derive(Debug, Serialize)]
pub struct SaleWithItems {
    #[serde(flatten)]
    pub sale:  Sale,
    pub items: Vec<SaleItem>,
}

#[derive(Debug, Deserialize)]
pub struct SaleItemInput {
    pub product_id: i64,
    pub quantity:   f64,
    pub unit_price: i64,
    pub unit_cost:  i64,
    pub price_tier: Option<String>,
    pub discount:   Option<i64>,
    pub tva_amount: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSalePayload {
    pub session_id:     Option<i64>,
    pub cashier_id:     i64,
    pub customer_id:    Option<i64>,
    pub items:          Vec<SaleItemInput>,
    pub discount:       Option<i64>,
    pub amount_paid:    i64,
    pub payment_method: Option<String>,
    pub notes:          Option<String>,
}

// ── Inventory ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ProductStock {
    pub product_id:           i64,
    pub barcode:              Option<String>,
    pub internal_code:        Option<String>,
    pub name:                 String,
    pub category_id:          Option<i64>,
    pub category_name:        Option<String>,
    pub supplier_id:          Option<i64>,
    pub item_type:            String,
    pub unit:                 String,
    pub packaging_qty:        i32,
    pub cost_price:           i64,
    pub sell_price_retail:    i64,
    pub sell_price_wholesale: i64,
    pub sell_price_special:   i64,
    pub tva_rate:             f64,
    pub apply_tva:            bool,
    pub apply_discount:       bool,
    pub sold_by_amount:       bool,
    pub min_stock:            f64,
    pub expiry_date:          Option<NaiveDate>,
    pub is_active:            bool,
    pub is_frozen:            bool,
    pub stock_qty:            f64,
    pub low_stock_flag:       bool,
}

#[derive(Debug, Deserialize)]
pub struct AdjustInventoryPayload {
    pub product_id:    i64,
    pub quantity_delta: f64,
    pub movement_type: String,
    pub notes:         Option<String>,
    pub created_by:    i64,
}

// ── Auth ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub pin:      String,
}

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub user: User,
}
