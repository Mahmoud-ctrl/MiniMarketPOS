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
  stock_qty: number;
  low_stock_flag: boolean;
}

export type PriceTier = "retail" | "wholesale" | "special";

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  price_tier: PriceTier;
  discount: number;
}

export interface AppError {
  message: string;
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
