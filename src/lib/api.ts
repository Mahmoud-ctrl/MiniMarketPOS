import { invoke } from "@tauri-apps/api/core";
import { CashierStatsRow, CashSession, Category, Customer, CustomerLedgerEntry, CustomerWithBalance, DailySalesRow, PriceTier, Product, ProductStock, Purchase, PurchaseWithItems, Sale, SaleWithItems, SalesSummary, Setting, Supplier, TopCustomerRow, TopProductRow, User } from "../types";

interface LoginResult { user: User }

export const api = {
  // ── Auth ──────────────────────────────────────────────────────
  login: (username: string, pin: string) =>
    invoke<LoginResult>("login", { payload: { username, pin } }),

  getUsers: () =>
    invoke<User[]>("get_users"),

  createUser: (username: string, fullName: string, role: string, pin: string) =>
    invoke<User>("create_user", { username, fullName, role, pin }),

  setPin: (userId: number, newPin: string) =>
    invoke<void>("set_pin", { userId, newPin }),

  // ── Products ──────────────────────────────────────────────────
  getProducts: (params?: {
    search?: string;
    category_id?: number;
    supplier_id?: number;
    limit?: number;
    offset?: number;
  }) => invoke<Product[]>("get_products", {
    search:      params?.search      ?? null,
    categoryId:  params?.category_id ?? null,
    supplierId:  params?.supplier_id ?? null,
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

  createCategory: (payload: { name: string; description?: string | null; parent_id?: number | null }) =>
    invoke<Category>("create_category", { payload }),

  updateCategory: (id: number, name: string | null, description: string | null, parentId: number | null) =>
    invoke<Category>("update_category", { id, name, description, parentId }),

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
    invoke<ProductStock[]>("get_product_stock", { productId: product_id ?? null }),

  getLowStock: () =>
    invoke<ProductStock[]>("get_low_stock"),

  adjustInventory: (payload: {
    product_id: number;
    quantity_delta: number;
    movement_type: string;
    notes?: string | null;
    created_by: number;
  }) => invoke<void>("adjust_inventory", { payload }),

  receiveStock: (args: {
    product_id: number;
    quantity: number;
    notes?: string | null;
    created_by: number;
  }) => invoke<void>("receive_stock", {
    productId:  args.product_id,
    quantity:   args.quantity,
    notes:      args.notes ?? null,
    createdBy:  args.created_by,
  }),

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
  }) => invoke<Sale>("create_sale", { payload }),

  getSales: (params?: {
    dateFrom?: string;
    dateTo?: string;
    cashierId?: number;
    limit?: number;
    offset?: number;
    barcode?: string;
    status?: string;
    paymentMethod?: string;
  }) => invoke<Sale[]>("get_sales", {
    dateFrom:      params?.dateFrom      ?? null,
    dateTo:        params?.dateTo        ?? null,
    cashierId:     params?.cashierId     ?? null,
    limit:         params?.limit         ?? null,
    offset:        params?.offset        ?? null,
    barcode:       params?.barcode       ?? null,
    status:        params?.status        ?? null,
    paymentMethod: params?.paymentMethod ?? null,
  }),

  getSaleById: (id: number) =>
    invoke<SaleWithItems | null>("get_sale_by_id", { id }),

  voidSale: (saleId: number, voidedBy: number) =>
    invoke<Sale>("void_sale", { saleId, voidedBy }),

  // ── Purchases ─────────────────────────────────────────────────
  createPurchase: (payload: {
    supplier_id?: number | null;
    created_by: number;
    reference_no?: string | null;
    notes?: string | null;
    items: { product_id: number; quantity: number; unit_cost: number }[];
  }) => invoke<PurchaseWithItems>("create_purchase", { payload }),

  getPurchases: (params?: {
    supplier_id?: number | null;
    status?: string | null;
    limit?: number;
    offset?: number;
  }) => invoke<Purchase[]>("get_purchases", {
    supplierId:  params?.supplier_id ?? null,
    status:      params?.status      ?? null,
    limit:       params?.limit       ?? null,
    offset:      params?.offset      ?? null,
  }),

  getPurchaseById: (id: number) =>
    invoke<PurchaseWithItems>("get_purchase_by_id", { id }),

  receivePurchase: (id: number, receivedBy: number) =>
    invoke<Purchase>("receive_purchase", { id, receivedBy }),

  cancelPurchase: (id: number) =>
    invoke<Purchase>("cancel_purchase", { id }),

  voidPurchase: (id: number, voidedBy: number) =>
    invoke<Purchase>("void_purchase", { id, voidedBy }),

  // ── Settings ──────────────────────────────────────────────────
  getSettings: () =>
    invoke<Setting[]>("get_settings"),

  updateSetting: (key: string, value: string) =>
    invoke<Setting>("update_setting", { key, value }),

  // ── Cash sessions ─────────────────────────────────────────────
  openCashSession: (cashierId: number, openingBalance: number) =>
    invoke<CashSession>("open_cash_session", { cashierId, openingBalance, notes: null }),

  closeSession: (sessionId: number) =>
    invoke<CashSession>("close_cash_session", { sessionId, closingBalance: 0, notes: null }),

  getActiveSession: (cashierId: number) =>
    invoke<CashSession | null>("get_active_session", { cashierId }),

  // ── Reports ───────────────────────────────────────────────────
  getSalesSummary: (dateFrom?: string | null, dateTo?: string | null) =>
    invoke<SalesSummary>("get_sales_summary", { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null }),

  getDailySales: (dateFrom?: string | null, dateTo?: string | null) =>
    invoke<DailySalesRow[]>("get_daily_sales", { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null }),

  getTopProducts: (dateFrom?: string | null, dateTo?: string | null, limit?: number | null) =>
    invoke<TopProductRow[]>("get_top_products", { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, limit: limit ?? null }),

  getTopCustomers: (dateFrom?: string | null, dateTo?: string | null, limit?: number | null) =>
    invoke<TopCustomerRow[]>("get_top_customers", { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, limit: limit ?? null }),

  getCashierStats: (dateFrom?: string | null, dateTo?: string | null) =>
    invoke<CashierStatsRow[]>("get_cashier_stats", { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null }),

  // ── Customers ─────────────────────────────────────────────────
  getCustomers: () =>
    invoke<CustomerWithBalance[]>("get_customers"),

  searchCustomers: (query: string) =>
    invoke<Customer[]>("search_customers", { query }),

  createCustomer: (name: string, phone?: string | null, notes?: string | null) =>
    invoke<Customer>("create_customer", { name, phone: phone ?? null, notes: notes ?? null }),

  createCustomerQuick: (name: string, phone?: string | null) =>
    invoke<Customer>("create_customer_quick", { name, phone: phone ?? null }),

  updateCustomer: (id: number, name: string, phone?: string | null, email?: string | null, notes?: string | null) =>
    invoke<Customer>("update_customer", { id, name, phone: phone ?? null, email: email ?? null, notes: notes ?? null }),

  deactivateCustomer: (id: number) =>
    invoke<Customer>("deactivate_customer", { id }),

  getCustomerLedger: (customerId: number) =>
    invoke<CustomerLedgerEntry[]>("get_customer_ledger", { customerId }),

  getCustomerSales: (customerId: number) =>
    invoke<Sale[]>("get_customer_sales", { customerId }),

  recordCustomerPayment: (args: {
    customerId: number;
    amount: number;
    saleId?: number | null;
    notes?: string | null;
    createdBy: number;
  }) => invoke<CustomerWithBalance>("record_customer_payment", {
    customerId: args.customerId,
    amount:     args.amount,
    saleId:     args.saleId    ?? null,
    notes:      args.notes     ?? null,
    createdBy:  args.createdBy,
  }),
};
