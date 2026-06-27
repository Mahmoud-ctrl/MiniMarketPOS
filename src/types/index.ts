export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "manager" | "cashier";
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

export interface Product {
  id: number;
  barcode: string | null;
  internal_code: string | null;
  name: string;
  category_id: number | null;
  supplier_id: number | null;
  item_type: string;
  unit: string;
  packaging_qty: number;
  cost_price: number;
  sell_price_retail: number;
  sell_price_wholesale: number;
  sell_price_special: number;
  tva_rate: number;
  apply_tva: boolean;
  apply_discount: boolean;
  sold_by_amount: boolean;
  min_stock: number;
  expiry_date: string | null;
  is_active: boolean;
  is_frozen: boolean;
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  is_variable_price: boolean;
  is_favorite: boolean;
}

// Matches v_product_stock view — note product_id (not id) and extra stock fields
export interface ProductStock {
  product_id: number;
  barcode: string | null;
  internal_code: string | null;
  name: string;
  category_id: number | null;
  category_name: string | null;
  supplier_id: number | null;
  item_type: string;
  unit: string;
  packaging_qty: number;
  cost_price: number;
  sell_price_retail: number;
  sell_price_wholesale: number;
  sell_price_special: number;
  tva_rate: number;
  apply_tva: boolean;
  apply_discount: boolean;
  sold_by_amount: boolean;
  min_stock: number;
  expiry_date: string | null;
  is_active: boolean;
  is_frozen: boolean;
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  is_variable_price: boolean;
  is_favorite: boolean;
  stock_qty: number;
  low_stock_flag: boolean;
}

// Matches v_perishable_alerts view
export interface PerishableAlert {
  product_id: number;
  name: string;
  unit: string;
  category_name: string | null;
  stock_qty: number;
  sell_price_retail: number;
  cost_price: number;
  default_shelf_life_days: number | null;
  last_received_at: string | null;
  estimated_expiry: string | null;
  days_until_expiry: number | null;
}

export type PriceTier = "retail" | "wholesale" | "special";

export interface CartItem {
  lineId:          number;   // unique per line in a tab
  product:         Product;
  quantity:        number;
  unit_price:      number;   // price for this unit (pack price = piece_price * unit_multiplier)
  price_tier:      PriceTier;
  discount:        number;   // per-unit discount in cents
  unit_multiplier: number;   // 1 = piece, packaging_qty = pack/case
  unit_label:      string;   // display label ("pcs", "pack", …)
}

// ── No-sale events ────────────────────────────────────────────────────────────

export interface NoSaleEvent {
  id:         number;
  cashier_id: number;
  session_id: number | null;
  notes:      string | null;
  created_at: string;
}

// ── Promotions ─────────────────────────────────────────────────────────────────

export interface Promotion {
  id:         number;
  name:       string;
  product_id: number;
  buy_qty:    number;
  get_qty:    number;
  is_active:  boolean;
  created_at: string;
}

// ── Sale Returns ──────────────────────────────────────────────────────────────

export interface SaleReturn {
  id:               number;
  original_sale_id: number;
  cashier_id:       number;
  total_refund:     number;
  notes:            string | null;
  created_at:       string;
  items:            SaleReturnItem[];
}

export interface SaleReturnItem {
  id:            number;
  return_id:     number;
  sale_item_id:  number;
  product_id:    number;
  quantity:      number;
  unit_price:    number;
  refund_amount: number;
  is_resellable: boolean;
  created_at:    string;
}

export interface AppError {
  message: string;
}

// ── Price History ─────────────────────────────────────────────────────────────

export interface PriceHistoryEntry {
  id:              number;
  product_id:      number;
  changed_by:      number | null;
  changed_by_name: string | null;
  changed_at:      string;
  field_name:      "cost_price" | "sell_price_retail" | "sell_price_wholesale" | "sell_price_special";
  old_value:       number | null;
  new_value:       number;
}

// ── Purchases ─────────────────────────────────────────────────────────────────

export interface Purchase {
  id: number;
  supplier_id: number | null;
  supplier_name: string | null;
  created_by: number | null;
  received_by: number | null;
  reference_no: string | null;
  total_amount: number;         // BIGINT cents
  status: "pending" | "received" | "cancelled";
  notes: string | null;
  created_at: string;
  received_at: string | null;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_cost: number;   // BIGINT cents
  subtotal: number;    // BIGINT cents
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export interface Sale {
  id: number;
  session_id: number | null;
  cashier_id: number;
  customer_id: number | null;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  change_given: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
  paid_primary: number;
  paid_secondary: number;
  exchange_rate_snapshot: number;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  product_barcode: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  price_tier: string;
  discount: number;
  tva_amount: number;
  subtotal: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  points: number;
  is_active: boolean;
  created_at: string;
}

export interface CustomerWithBalance extends Customer {
  balance_due: number;
}

export interface CustomerLedgerEntry {
  id: number;
  customer_id: number;
  amount: number;
  entry_type: "credit" | "payment" | "reversal";
  sale_id: number | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

// ── Cash Sessions ─────────────────────────────────────────────────────────────

export interface CashSession {
  id: number;
  cashier_id: number;
  opening_balance: number;
  closing_balance: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface WasteSummary {
  total_waste_value:  number;
  total_waste_events: number;
  total_waste_qty:    number;
}

export interface TopWasterRow {
  product_id:   number;
  product_name: string;
  unit:         string;
  waste_qty:    number;
  waste_value:  number;
  waste_events: number;
}

export interface DailyWasteRow {
  date:         string;
  waste_value:  number;
  waste_qty:    number;
  waste_events: number;
}

export interface SalesSummary {
  total_revenue:     number;
  transaction_count: number;
  average_order:     number;
  total_discount:    number;
  total_tax:         number;
  cash_collected:    number;
  credit_collected:  number;
  debt_added:        number;
}

export interface DailySalesRow {
  date:         string;
  revenue:      number;
  transactions: number;
}

export interface TopProductRow {
  product_id:        number;
  product_name:      string;
  quantity_sold:     number;
  revenue:           number;
  transaction_count: number;
}

export interface TopCustomerRow {
  customer_id:   number;
  customer_name: string;
  total_spent:   number;
  visit_count:   number;
  balance_due:   number;
}

export interface CashierStatsRow {
  cashier_id:        number;
  cashier_name:      string;
  total_sales:       number;
  transaction_count: number;
  average_order:     number;
}
