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
