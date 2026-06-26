-- ============================================================
-- 010 — Perishables: shelf-life tracking + waste logging
-- ============================================================

-- 1. Add perishable fields to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_perishable          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS default_shelf_life_days INTEGER;

-- 2. Add 'waste' to inventory_movements movement_type
--    Drop the auto-generated inline CHECK and recreate it.
ALTER TABLE inventory_movements
    DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_movement_type_check
    CHECK (movement_type IN (
        'opening', 'purchase', 'sale',
        'return_in', 'return_out',
        'damage', 'adjustment', 'waste'
    ));

-- 3. Rebuild v_product_stock to include new columns
DROP VIEW IF EXISTS v_product_stock;
CREATE VIEW v_product_stock AS
SELECT
    p.id                         AS product_id,
    p.barcode,
    p.internal_code,
    p.name,
    p.category_id,
    c.name                       AS category_name,
    p.supplier_id,
    p.item_type,
    p.unit,
    p.packaging_qty,
    p.cost_price,
    p.sell_price_retail,
    p.sell_price_wholesale,
    p.sell_price_special,
    p.tva_rate,
    p.apply_tva,
    p.apply_discount,
    p.sold_by_amount,
    p.min_stock,
    p.expiry_date,
    p.is_active,
    p.is_frozen,
    p.is_perishable,
    p.default_shelf_life_days,
    COALESCE(SUM(m.quantity_delta), 0.0)                                       AS stock_qty,
    (COALESCE(SUM(m.quantity_delta), 0.0) <= p.min_stock AND p.min_stock > 0) AS low_stock_flag
FROM products p
LEFT JOIN categories c          ON p.category_id = c.id
LEFT JOIN inventory_movements m ON p.id = m.product_id
GROUP BY p.id, c.name;

-- 4. View: perishable alerts
--    estimated_expiry = last positive receipt date + shelf life days
--    days_until_expiry: negative = already overdue, 0 = expires today
CREATE OR REPLACE VIEW v_perishable_alerts AS
SELECT
    ps.product_id,
    ps.name,
    ps.unit,
    ps.category_name,
    ps.stock_qty,
    ps.sell_price_retail,
    ps.cost_price,
    ps.default_shelf_life_days,
    lr.last_received_at,
    CASE
        WHEN ps.default_shelf_life_days IS NOT NULL AND lr.last_received_at IS NOT NULL
        THEN (lr.last_received_at::DATE + ps.default_shelf_life_days)
        ELSE NULL
    END AS estimated_expiry,
    CASE
        WHEN ps.default_shelf_life_days IS NOT NULL AND lr.last_received_at IS NOT NULL
        THEN ((lr.last_received_at::DATE + ps.default_shelf_life_days) - CURRENT_DATE)::INTEGER
        ELSE NULL
    END AS days_until_expiry
FROM v_product_stock ps
LEFT JOIN (
    SELECT
        product_id,
        MAX(created_at) AS last_received_at
    FROM inventory_movements
    WHERE movement_type IN ('purchase', 'opening', 'adjustment', 'return_in')
      AND quantity_delta > 0
    GROUP BY product_id
) lr ON lr.product_id = ps.product_id
WHERE ps.is_perishable = TRUE
  AND ps.is_active     = TRUE
  AND ps.stock_qty     > 0;
