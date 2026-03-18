-- Phase 5: Part 3 - Functions

CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(p_product_id UUID, p_quantity INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available INTEGER;
BEGIN
  SELECT stock_quantity - COALESCE(reserved_quantity, 0) INTO v_available FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_available IS NULL OR v_available < p_quantity THEN RETURN FALSE; END IF;
  UPDATE products SET reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity, updated_at = NOW() WHERE id = p_product_id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.release_reserved_inventory(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE products SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity), updated_at = NOW() WHERE id = p_product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_reserved_inventory(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - p_quantity), reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity), updated_at = NOW() WHERE id = p_product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.calculate_order_taxes(p_tenant_id UUID, p_subtotal NUMERIC, p_category TEXT DEFAULT 'all', p_tax_exempt BOOLEAN DEFAULT false)
RETURNS TABLE(tax_type TEXT, tax_name TEXT, tax_rate NUMERIC, tax_amount NUMERIC) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_tax_exempt THEN RETURN; END IF;
  RETURN QUERY SELECT tr.tax_type, tr.name, tr.rate, ROUND((p_subtotal * tr.rate / 100), 2)
  FROM tax_rates tr WHERE tr.tenant_id = p_tenant_id AND tr.is_active = true AND tr.effective_date <= CURRENT_DATE AND (tr.end_date IS NULL OR tr.end_date >= CURRENT_DATE);
END; $$;

GRANT EXECUTE ON FUNCTION public.reserve_inventory_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_reserved_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_reserved_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_order_taxes TO authenticated;