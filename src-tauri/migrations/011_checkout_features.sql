-- ============================================================
-- 011 — Checkout features:
--   • is_variable_price + is_favorite on products
--   • promotions (same-product BOGO)
--   • no_sale_events (audit log)
--   • sale_returns + sale_return_items (partial returns)
-- ============================================================

-- Variable price flag: cashier enters price at sale time
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_variable_price BOOLEAN NOT NULL DEFAULT false;

-- Favorites flag: appears in quick-key grid on POS
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

-- BOGO promotions: "buy buy_qty get get_qty free" for the same product
CREATE TABLE IF NOT EXISTS promotions (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buy_qty     FLOAT NOT NULL DEFAULT 2,
    get_qty     FLOAT NOT NULL DEFAULT 1,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for "no sale" cash drawer opens
CREATE TABLE IF NOT EXISTS no_sale_events (
    id          BIGSERIAL PRIMARY KEY,
    cashier_id  BIGINT NOT NULL REFERENCES users(id),
    session_id  BIGINT REFERENCES cash_sessions(id),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial return headers
CREATE TABLE IF NOT EXISTS sale_returns (
    id               BIGSERIAL PRIMARY KEY,
    original_sale_id BIGINT NOT NULL REFERENCES sales(id),
    cashier_id       BIGINT NOT NULL REFERENCES users(id),
    total_refund     BIGINT NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial return line items
CREATE TABLE IF NOT EXISTS sale_return_items (
    id            BIGSERIAL PRIMARY KEY,
    return_id     BIGINT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id  BIGINT NOT NULL REFERENCES sale_items(id),
    product_id    BIGINT NOT NULL REFERENCES products(id),
    quantity      FLOAT NOT NULL,
    unit_price    BIGINT NOT NULL,
    refund_amount BIGINT NOT NULL,
    is_resellable BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
