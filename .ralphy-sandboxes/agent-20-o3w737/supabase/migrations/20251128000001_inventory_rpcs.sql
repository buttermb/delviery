-- RPC functions for atomic inventory updates

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, stock_quantity - p_quantity),
    last_synced_at = NOW(),
    sync_source = 'system'
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = stock_quantity + p_quantity,
    last_synced_at = NOW(),
    sync_source = 'system'
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;
