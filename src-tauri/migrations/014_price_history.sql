CREATE TABLE IF NOT EXISTS price_history (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    changed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    field_name  TEXT NOT NULL CHECK (field_name IN ('cost_price','sell_price_retail','sell_price_wholesale','sell_price_special')),
    old_value   BIGINT,
    new_value   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS price_history_product_idx ON price_history(product_id, changed_at DESC);
