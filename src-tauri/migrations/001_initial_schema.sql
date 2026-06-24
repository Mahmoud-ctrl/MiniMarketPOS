
-- ============================================================
-- Shared trigger: keeps updated_at current on any table
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS 
--
-- PIN login: cashiers enter a 4–6 digit PIN at the POS screen.
-- pin_hash stores the Argon2 hash of that PIN.
-- username is kept for admin identification / setup only.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id        BIGSERIAL   PRIMARY KEY,
    username  TEXT        NOT NULL UNIQUE,
    pin_hash  TEXT        NOT NULL,           -- Argon2 hash of 4–6 digit PIN
    full_name TEXT        NOT NULL,
    role      TEXT        NOT NULL DEFAULT 'cashier'
                          CHECK (role IN ('admin', 'manager', 'cashier')),
    is_active BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed admin — set a real pin_hash before first use
INSERT INTO users (username, pin_hash, full_name, role)
VALUES ('admin', '1234', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- CATEGORIES  (مجموعات)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          BIGSERIAL   PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPPLIERS  (موردون / مصادر)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id          BIGSERIAL   PRIMARY KEY,
    name        TEXT        NOT NULL,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
--
-- 3 price tiers matching the reference system:
--   sell_price_retail    = سعر البيع / مفرق  (default POS price)
--   sell_price_wholesale = سعر البيع / جملة
--   sell_price_special   = سعر البيع / خاص
--
-- Box vs piece: two separate product entries
-- (e.g. "Winston Light *10" for box, "Winston Light" for single).
-- packaging_qty links them: box price ≈ piece price × packaging_qty.
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id                   BIGSERIAL        PRIMARY KEY,

    barcode              TEXT             UNIQUE,
    internal_code        TEXT             UNIQUE,
    name                 TEXT             NOT NULL,
    category_id          BIGINT           REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id          BIGINT           REFERENCES suppliers(id)  ON DELETE SET NULL,

    item_type            TEXT             NOT NULL DEFAULT 'consumable'
                                          CHECK (item_type IN ('consumable', 'non_consumable', 'service')),
    unit                 TEXT             NOT NULL DEFAULT 'pcs',
    packaging_qty        INTEGER          NOT NULL DEFAULT 1,

    cost_price           BIGINT           NOT NULL DEFAULT 0,
    sell_price_retail    BIGINT           NOT NULL DEFAULT 0,
    sell_price_wholesale BIGINT           NOT NULL DEFAULT 0,
    sell_price_special   BIGINT           NOT NULL DEFAULT 0,

    tva_rate             DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    apply_tva            BOOLEAN          NOT NULL DEFAULT FALSE,
    apply_discount       BOOLEAN          NOT NULL DEFAULT TRUE,
    sold_by_amount       BOOLEAN          NOT NULL DEFAULT FALSE,

    min_stock            DOUBLE PRECISION NOT NULL DEFAULT 0,
    expiry_date          DATE,

    is_active            BOOLEAN          NOT NULL DEFAULT TRUE,
    is_frozen            BOOLEAN          NOT NULL DEFAULT FALSE,

    created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode
    ON products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_internal_code
    ON products (internal_code) WHERE internal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active   ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_expiry
    ON products (expiry_date) WHERE expiry_date IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CUSTOMERS 
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id          BIGSERIAL   PRIMARY KEY,
    name        TEXT        NOT NULL,
    phone       TEXT        UNIQUE,
    email       TEXT,
    points      BIGINT      NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CASH SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_sessions (
    id              BIGSERIAL   PRIMARY KEY,
    cashier_id      BIGINT      NOT NULL REFERENCES users(id),
    opening_balance BIGINT      NOT NULL,
    closing_balance BIGINT,
    notes           TEXT,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_cashier_id ON cash_sessions (cashier_id);

-- ============================================================
-- SALES 
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
    id             BIGSERIAL   PRIMARY KEY,
    session_id     BIGINT      REFERENCES cash_sessions(id),
    cashier_id     BIGINT      NOT NULL REFERENCES users(id),
    customer_id    BIGINT      REFERENCES customers(id) ON DELETE SET NULL,

    subtotal       BIGINT      NOT NULL,
    discount       BIGINT      NOT NULL DEFAULT 0,
    tax            BIGINT      NOT NULL DEFAULT 0,
    total_amount   BIGINT      NOT NULL,
    amount_paid    BIGINT      NOT NULL,
    change_given   BIGINT      NOT NULL DEFAULT 0,

    payment_method TEXT        NOT NULL DEFAULT 'cash'
                               CHECK (payment_method IN ('cash', 'card', 'wallet', 'credit')),
    status         TEXT        NOT NULL DEFAULT 'completed'
                               CHECK (status IN ('completed', 'refunded', 'void')),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_cashier_id  ON sales (cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at  ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status      ON sales (status);

-- ============================================================
-- SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id         BIGSERIAL        PRIMARY KEY,
    sale_id    BIGINT           NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id BIGINT           NOT NULL REFERENCES products(id),

    quantity   DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
    unit_price BIGINT           NOT NULL,
    unit_cost  BIGINT           NOT NULL,
    price_tier TEXT             NOT NULL DEFAULT 'retail'
                                CHECK (price_tier IN ('retail', 'wholesale', 'special')),
    discount   BIGINT           NOT NULL DEFAULT 0,
    tva_amount BIGINT           NOT NULL DEFAULT 0,
    subtotal   BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id    ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
    id           BIGSERIAL   PRIMARY KEY,
    supplier_id  BIGINT      REFERENCES suppliers(id) ON DELETE SET NULL,
    received_by  BIGINT      NOT NULL REFERENCES users(id),
    reference_no TEXT,
    total_amount BIGINT      NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'received'
                             CHECK (status IN ('pending', 'received', 'cancelled')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at  ON purchases (created_at);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id          BIGSERIAL        PRIMARY KEY,
    purchase_id BIGINT           NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id  BIGINT           NOT NULL REFERENCES products(id),
    quantity    DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
    unit_cost   BIGINT           NOT NULL,
    subtotal    BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id  ON purchase_items (product_id);

-- ============================================================
-- INVENTORY MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id             BIGSERIAL        PRIMARY KEY,
    product_id     BIGINT           NOT NULL REFERENCES products(id),
    quantity_delta DOUBLE PRECISION NOT NULL,
    movement_type  TEXT             NOT NULL
                                    CHECK (movement_type IN (
                                        'opening',
                                        'purchase',
                                        'sale',
                                        'return_in',
                                        'return_out',
                                        'damage',
                                        'adjustment'
                                    )),
    reference_id   BIGINT,
    notes          TEXT,
    created_by     BIGINT           REFERENCES users(id),
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_product_id ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inv_created_at ON inventory_movements (created_at);
CREATE INDEX IF NOT EXISTS idx_inv_type       ON inventory_movements (movement_type);

-- ============================================================
-- VIEW: current stock + low-stock flag per product
-- ============================================================
CREATE OR REPLACE VIEW v_product_stock AS
SELECT
    p.id                    AS product_id,
    p.barcode,
    p.internal_code,
    p.name,
    p.unit,
    p.packaging_qty,
    p.cost_price,
    p.sell_price_retail,
    p.sell_price_wholesale,
    p.sell_price_special,
    p.tva_rate,
    p.apply_tva,
    p.min_stock,
    p.expiry_date,
    p.is_active,
    p.is_frozen,
    COALESCE(SUM(m.quantity_delta), 0.0)             AS stock_qty,
    COALESCE(SUM(m.quantity_delta), 0.0) <= p.min_stock AS low_stock_flag
FROM products p
LEFT JOIN inventory_movements m ON m.product_id = p.id
GROUP BY p.id;
