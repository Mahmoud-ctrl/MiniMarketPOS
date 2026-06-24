-- Extend v_product_stock with fields needed for inventory management UI.
-- category_id, category_name, supplier_id, item_type, apply_discount, sold_by_amount
-- were missing from the original view.
CREATE OR REPLACE VIEW v_product_stock AS
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
    COALESCE(SUM(m.quantity_delta), 0.0)                                          AS stock_qty,
    (COALESCE(SUM(m.quantity_delta), 0.0) <= p.min_stock AND p.min_stock > 0)    AS low_stock_flag
FROM products p
LEFT JOIN categories c           ON p.category_id = c.id
LEFT JOIN inventory_movements m  ON p.id = m.product_id
GROUP BY p.id, c.name;
