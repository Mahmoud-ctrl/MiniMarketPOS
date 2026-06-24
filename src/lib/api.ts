import { invoke } from "@tauri-apps/api/core";
import { Category, PriceTier, Product, ProductStock, Supplier, User } from "../types";

interface LoginResult { user: User }

export const api = {
  // ── Auth ──────────────────────────────────────────────────────
  login: (username: string, pin: string) =>
    invoke<LoginResult>("login", { payload: { username, pin } }),

  getUsers: () =>
    invoke<User[]>("get_users"),

  createUser: (username: string, full_name: string, role: string, pin: string) =>
    invoke<User>("create_user", { username, full_name, role, pin }),

  setPin: (user_id: number, new_pin: string) =>
    invoke<void>("set_pin", { user_id, new_pin }),

  // ── Products ──────────────────────────────────────────────────
  getProducts: (params?: {
    search?: string;
    category_id?: number;
    supplier_id?: number;
    limit?: number;
    offset?: number;
  }) => invoke<Product[]>("get_products", {
    search:      params?.search      ?? null,
    category_id: params?.category_id ?? null,
    supplier_id: params?.supplier_id ?? null,
    limit:       params?.limit       ?? null,
    offset:      params?.offset      ?? null,
  }),

  getProductByBarcode: (barcode: string) =>
    invoke<Product | null>("get_product_by_barcode", { barcode }),

  getProductById: (id: number) =>
    invoke<Product | null>("get_product_by_id", { id }),

  createProduct: (payload: {
    barcode?: string | null;
    internal_code?: string | null;
    name: string;
    category_id?: number | null;
    supplier_id?: number | null;
    item_type?: string;
    unit?: string;
    packaging_qty?: number;
    cost_price: number;
    sell_price_retail: number;
    sell_price_wholesale?: number;
    sell_price_special?: number;
    tva_rate?: number;
    apply_tva?: boolean;
    apply_discount?: boolean;
    sold_by_amount?: boolean;
    min_stock?: number;
    expiry_date?: string | null;
  }) => invoke<Product>("create_product", { payload }),

  updateProduct: (id: number, payload: {
    barcode?: string | null;
    internal_code?: string | null;
    name?: string;
    category_id?: number | null;
    supplier_id?: number | null;
    item_type?: string;
    unit?: string;
    packaging_qty?: number;
    cost_price?: number;
    sell_price_retail?: number;
    sell_price_wholesale?: number;
    sell_price_special?: number;
    tva_rate?: number;
    apply_tva?: boolean;
    apply_discount?: boolean;
    sold_by_amount?: boolean;
    min_stock?: number;
    expiry_date?: string | null;
  }) => invoke<Product>("update_product", { id, payload }),

  toggleProductFrozen: (id: number) =>
    invoke<Product>("toggle_product_frozen", { id }),

  deactivateProduct: (id: number) =>
    invoke<Product>("deactivate_product", { id }),

  // ── Categories ────────────────────────────────────────────────
  getCategories: () =>
    invoke<Category[]>("get_categories"),

  createCategory: (payload: { name: string; description?: string | null }) =>
    invoke<Category>("create_category", { payload }),

  updateCategory: (id: number, name?: string, description?: string | null) =>
    invoke<Category>("update_category", { id, name: name ?? null, description: description ?? null }),

  deleteCategory: (id: number) =>
    invoke<void>("delete_category", { id }),

  // ── Suppliers ─────────────────────────────────────────────────
  getSuppliers: () =>
    invoke<Supplier[]>("get_suppliers"),

  createSupplier: (payload: { name: string; phone?: string | null; email?: string | null; address?: string | null }) =>
    invoke<Supplier>("create_supplier", { payload }),

  updateSupplier: (id: number, name?: string, phone?: string | null, email?: string | null, address?: string | null) =>
    invoke<Supplier>("update_supplier", { id, name: name ?? null, phone: phone ?? null, email: email ?? null, address: address ?? null }),

  // ── Inventory ─────────────────────────────────────────────────
  getProductStock: (product_id?: number) =>
    invoke<ProductStock[]>("get_product_stock", { product_id: product_id ?? null }),

  getLowStock: () =>
    invoke<ProductStock[]>("get_low_stock"),

  adjustInventory: (payload: {
    product_id: number;
    quantity_delta: number;
    movement_type: string;
    notes?: string | null;
    created_by: number;
  }) => invoke<void>("adjust_inventory", { payload }),

  // ── Sales ─────────────────────────────────────────────────────
  createSale: (payload: {
    session_id?: number;
    cashier_id: number;
    customer_id?: number;
    items: {
      product_id: number;
      quantity: number;
      unit_price: number;
      unit_cost: number;
      price_tier?: PriceTier;
      discount?: number;
      tva_amount?: number;
    }[];
    discount?: number;
    amount_paid: number;
    payment_method?: "cash" | "card" | "wallet" | "credit";
    notes?: string;
  }) => invoke<{ id: number }>("create_sale", { payload }),

  // ── Cash sessions ─────────────────────────────────────────────
  openCashSession: (cashier_id: number, opening_balance: number) =>
    invoke<{ id: number }>("open_cash_session", { cashier_id, opening_balance, notes: null }),

  getActiveSession: (cashier_id: number) =>
    invoke<{ id: number } | null>("get_active_session", { cashier_id }),
};
