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
    pub parent_id:   Option<i64>,
    pub created_at:  DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryPayload {
    pub name:        String,
    pub description: Option<String>,
    pub parent_id:   Option<i64>,
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
    pub id:                       i64,
    pub barcode:                  Option<String>,
    pub internal_code:            Option<String>,
    pub name:                     String,
    pub category_id:              Option<i64>,
    pub supplier_id:              Option<i64>,
    pub item_type:                String,
    pub unit:                     String,
    pub packaging_qty:            i32,
    pub cost_price:               i64,
    pub sell_price_retail:        i64,
    pub sell_price_wholesale:     i64,
    pub sell_price_special:       i64,
    pub tva_rate:                 f64,
    pub apply_tva:                bool,
    pub apply_discount:           bool,
    pub sold_by_amount:           bool,
    pub min_stock:                f64,
    pub expiry_date:              Option<NaiveDate>,
    pub is_active:                bool,
    pub is_frozen:                bool,
    pub is_perishable:            bool,
    pub default_shelf_life_days:  Option<i32>,
    pub is_variable_price:        bool,
    pub is_favorite:              bool,
    pub created_at:               DateTime<Utc>,
    pub updated_at:               DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub barcode:                 Option<String>,
    pub internal_code:           Option<String>,
    pub name:                    String,
    pub category_id:             Option<i64>,
    pub supplier_id:             Option<i64>,
    pub item_type:               Option<String>,
    pub unit:                    Option<String>,
    pub packaging_qty:           Option<i32>,
    pub cost_price:              i64,
    pub sell_price_retail:       i64,
    pub sell_price_wholesale:    Option<i64>,
    pub sell_price_special:      Option<i64>,
    pub tva_rate:                Option<f64>,
    pub apply_tva:               Option<bool>,
    pub apply_discount:          Option<bool>,
    pub sold_by_amount:          Option<bool>,
    pub min_stock:               Option<f64>,
    pub expiry_date:             Option<String>, // "YYYY-MM-DD"
    pub is_perishable:           Option<bool>,
    pub default_shelf_life_days: Option<i32>,
    pub is_variable_price:       Option<bool>,
    pub is_favorite:             Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub barcode:                 Option<String>,
    pub internal_code:           Option<String>,
    pub name:                    Option<String>,
    pub category_id:             Option<i64>,
    pub supplier_id:             Option<i64>,
    pub item_type:               Option<String>,
    pub unit:                    Option<String>,
    pub packaging_qty:           Option<i32>,
    pub cost_price:              Option<i64>,
    pub sell_price_retail:       Option<i64>,
    pub sell_price_wholesale:    Option<i64>,
    pub sell_price_special:      Option<i64>,
    pub tva_rate:                Option<f64>,
    pub apply_tva:               Option<bool>,
    pub apply_discount:          Option<bool>,
    pub sold_by_amount:          Option<bool>,
    pub min_stock:               Option<f64>,
    pub expiry_date:             Option<String>,
    pub is_perishable:           Option<bool>,
    pub default_shelf_life_days: Option<i32>,
    pub is_variable_price:       Option<bool>,
    pub is_favorite:             Option<bool>,
}

// ── Customers ────────────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Debug, Serialize, FromRow)]
pub struct Customer {
    pub id:         i64,
    pub name:       String,
    pub phone:      Option<String>,
    pub email:      Option<String>,
    pub notes:      Option<String>,
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
    pub customer_name:  Option<String>,
    pub subtotal:       i64,
    pub discount:       i64,
    pub tax:            i64,
    pub total_amount:   i64,
    pub amount_paid:            i64,
    pub change_given:           i64,
    pub payment_method:         String,
    pub status:                 String,
    pub notes:                  Option<String>,
    pub created_at:             DateTime<Utc>,
    pub paid_primary:           i64,
    pub paid_secondary:         i64,
    pub exchange_rate_snapshot: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SaleItem {
    pub id:              i64,
    pub sale_id:         i64,
    pub product_id:      i64,
    pub product_name:    String,
    pub product_barcode: Option<String>,
    pub quantity:        f64,
    pub unit_price:      i64,
    pub unit_cost:       i64,
    pub price_tier:      String,
    pub discount:        i64,
    pub tva_amount:      i64,
    pub subtotal:        i64,
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
    pub amount_paid:            i64,
    pub payment_method:         Option<String>,
    pub notes:                  Option<String>,
    pub paid_primary:           Option<i64>,
    pub paid_secondary:         Option<i64>,
    pub exchange_rate_snapshot: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CustomerWithBalance {
    pub id:          i64,
    pub name:        String,
    pub phone:       Option<String>,
    pub email:       Option<String>,
    pub notes:       Option<String>,
    pub points:      i64,
    pub is_active:   bool,
    pub created_at:  DateTime<Utc>,
    pub balance_due: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CustomerLedgerEntry {
    pub id:          i64,
    pub customer_id: i64,
    pub amount:      i64,
    pub entry_type:  String,
    pub sale_id:     Option<i64>,
    pub notes:       Option<String>,
    pub created_by:  Option<i64>,
    pub created_at:  DateTime<Utc>,
}

// ── Inventory ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct ProductStock {
    pub product_id:              i64,
    pub barcode:                 Option<String>,
    pub internal_code:           Option<String>,
    pub name:                    String,
    pub category_id:             Option<i64>,
    pub category_name:           Option<String>,
    pub supplier_id:             Option<i64>,
    pub item_type:               String,
    pub unit:                    String,
    pub packaging_qty:           i32,
    pub cost_price:              i64,
    pub sell_price_retail:       i64,
    pub sell_price_wholesale:    i64,
    pub sell_price_special:      i64,
    pub tva_rate:                f64,
    pub apply_tva:               bool,
    pub apply_discount:          bool,
    pub sold_by_amount:          bool,
    pub min_stock:               f64,
    pub expiry_date:             Option<NaiveDate>,
    pub is_active:               bool,
    pub is_frozen:               bool,
    pub is_perishable:           bool,
    pub default_shelf_life_days: Option<i32>,
    pub is_variable_price:       bool,
    pub is_favorite:             bool,
    pub stock_qty:               f64,
    pub low_stock_flag:          bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PerishableAlert {
    pub product_id:              i64,
    pub name:                    String,
    pub unit:                    String,
    pub category_name:           Option<String>,
    pub stock_qty:               f64,
    pub sell_price_retail:       i64,
    pub cost_price:              i64,
    pub default_shelf_life_days: Option<i32>,
    pub last_received_at:        Option<DateTime<Utc>>,
    pub estimated_expiry:        Option<NaiveDate>,
    pub days_until_expiry:       Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct LogWastePayload {
    pub product_id: i64,
    pub quantity:   f64,
    pub notes:      Option<String>,
    pub created_by: i64,
}

#[derive(Debug, Deserialize)]
pub struct AdjustInventoryPayload {
    pub product_id:    i64,
    pub quantity_delta: f64,
    pub movement_type: String,
    pub notes:         Option<String>,
    pub created_by:    i64,
}

// ── Purchases ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Purchase {
    pub id:           i64,
    pub supplier_id:  Option<i64>,
    pub created_by:   Option<i64>,
    pub received_by:  Option<i64>,
    pub reference_no: Option<String>,
    pub total_amount: i64,
    pub status:       String,
    pub notes:        Option<String>,
    pub created_at:   DateTime<Utc>,
    pub received_at:  Option<DateTime<Utc>>,
    pub supplier_name: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PurchaseItemRow {
    pub id:           i64,
    pub purchase_id:  i64,
    pub product_id:   i64,
    pub product_name: String,
    pub unit:         String,
    pub quantity:     f64,
    pub unit_cost:    i64,
    pub subtotal:     i64,
}

#[derive(Debug, Serialize)]
pub struct PurchaseWithItems {
    #[serde(flatten)]
    pub purchase: Purchase,
    pub items:    Vec<PurchaseItemRow>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePurchaseItemPayload {
    pub product_id: i64,
    pub quantity:   f64,
    pub unit_cost:  i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePurchasePayload {
    pub supplier_id:  Option<i64>,
    pub created_by:   i64,
    pub reference_no: Option<String>,
    pub notes:        Option<String>,
    pub items:        Vec<CreatePurchaseItemPayload>,
}

// ── Promotions ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Promotion {
    pub id:         i64,
    pub name:       String,
    pub product_id: i64,
    pub buy_qty:    f64,
    pub get_qty:    f64,
    pub is_active:  bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePromotionPayload {
    pub name:       String,
    pub product_id: i64,
    pub buy_qty:    f64,
    pub get_qty:    f64,
}

// ── No-sale events ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct NoSaleEvent {
    pub id:         i64,
    pub cashier_id: i64,
    pub session_id: Option<i64>,
    pub notes:      Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Sale Returns ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct SaleReturn {
    pub id:               i64,
    pub original_sale_id: i64,
    pub cashier_id:       i64,
    pub total_refund:     i64,
    pub notes:            Option<String>,
    pub created_at:       DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SaleReturnItem {
    pub id:            i64,
    pub return_id:     i64,
    pub sale_item_id:  i64,
    pub product_id:    i64,
    pub quantity:      f64,
    pub unit_price:    i64,
    pub refund_amount: i64,
    pub is_resellable: bool,
    pub created_at:    DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SaleReturnWithItems {
    #[serde(flatten)]
    pub return_header: SaleReturn,
    pub items:         Vec<SaleReturnItem>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnItemInput {
    pub sale_item_id: i64,
    pub quantity:     f64,
    pub is_resellable: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateReturnPayload {
    pub original_sale_id: i64,
    pub cashier_id:       i64,
    pub items:            Vec<ReturnItemInput>,
    pub notes:            Option<String>,
}

// ── Price History ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct PriceHistoryEntry {
    pub id:              i64,
    pub product_id:      i64,
    pub changed_by:      Option<i64>,
    pub changed_by_name: Option<String>,
    pub changed_at:      DateTime<Utc>,
    pub field_name:      String,
    pub old_value:       Option<i64>,
    pub new_value:       i64,
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

// ── Settings ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct Setting {
    pub key:        String,
    pub value:      String,
    pub updated_at: DateTime<Utc>,
}

// ── Reports ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct WasteSummary {
    pub total_waste_value:  i64,
    pub total_waste_events: i64,
    pub total_waste_qty:    f64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TopWasterRow {
    pub product_id:   i64,
    pub product_name: String,
    pub unit:         String,
    pub waste_qty:    f64,
    pub waste_value:  i64,
    pub waste_events: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DailyWasteRow {
    pub date:         String,
    pub waste_value:  i64,
    pub waste_qty:    f64,
    pub waste_events: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SalesSummary {
    pub total_revenue:     i64,
    pub transaction_count: i64,
    pub average_order:     i64,
    pub total_discount:    i64,
    pub total_tax:         i64,
    pub cash_collected:    i64,
    pub credit_collected:  i64,
    pub debt_added:        i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DailySalesRow {
    pub date:         String,
    pub revenue:      i64,
    pub transactions: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TopProductRow {
    pub product_id:        i64,
    pub product_name:      String,
    pub quantity_sold:     f64,
    pub revenue:           i64,
    pub transaction_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TopCustomerRow {
    pub customer_id:   i64,
    pub customer_name: String,
    pub total_spent:   i64,
    pub visit_count:   i64,
    pub balance_due:   i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CashierStatsRow {
    pub cashier_id:        i64,
    pub cashier_name:      String,
    pub total_sales:       i64,
    pub transaction_count: i64,
    pub average_order:     i64,
}
