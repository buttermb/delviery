-- ============================================
-- SKU AUTO-GENERATION FUNCTION
-- Generates unique SKUs with category prefix + counter
-- ============================================

-- Function to get category prefix
CREATE OR REPLACE FUNCTION public.get_category_prefix(category_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN CASE LOWER(category_name)
    WHEN 'flower' THEN 'FLOW'
    WHEN 'vapes' THEN 'VAPE'
    WHEN 'edibles' THEN 'EDIB'
    WHEN 'concentrates' THEN 'CONC'
    ELSE 'PRD'
  END;
END;
$$;

-- Function to generate product SKU
CREATE OR REPLACE FUNCTION public.generate_product_sku(
  p_category TEXT,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_next_number INTEGER;
  v_sku TEXT;
BEGIN
  -- Get prefix for category
  v_prefix := public.get_category_prefix(p_category);
  
  -- Get or create sequence record and increment atomically
  -- This uses INSERT ... ON CONFLICT to handle both creation and update atomically
  INSERT INTO public.product_sku_sequences (category, tenant_id, prefix, last_number)
  VALUES (LOWER(p_category), p_tenant_id, v_prefix, 0)
  ON CONFLICT (category, tenant_id) DO UPDATE
  SET 
    last_number = product_sku_sequences.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_number;
  
  -- If insert succeeded (new record), use 1 as first number
  -- If update succeeded (existing record), last_number was already incremented
  IF v_next_number IS NULL THEN
    -- This shouldn't happen, but handle edge case
    SELECT last_number INTO v_next_number
    FROM public.product_sku_sequences
    WHERE category = LOWER(p_category) AND tenant_id = p_tenant_id;
    
    IF v_next_number IS NULL THEN
      v_next_number := 1;
    ELSE
      v_next_number := v_next_number + 1;
      UPDATE public.product_sku_sequences
      SET last_number = v_next_number, updated_at = now()
      WHERE category = LOWER(p_category) AND tenant_id = p_tenant_id;
    END IF;
  END IF;
  
  -- Format SKU: PREFIX-#### (4 digits, zero-padded)
  v_sku := v_prefix || '-' || LPAD(v_next_number::TEXT, 4, '0');
  
  RETURN v_sku;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_product_sku(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_prefix(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.generate_product_sku IS 'Generates unique SKU for product with category prefix and sequential number';

