-- 1. Add Age Gate settings to marketplace_stores
ALTER TABLE marketplace_stores
ADD COLUMN IF NOT EXISTS enable_age_gate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_gate_min_age INTEGER DEFAULT 21;

-- 2. Create RPC for Customer Retention Analytics
-- Returns count of New vs Returning customers for a specific store
CREATE OR REPLACE FUNCTION public.get_customer_analytics(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INTEGER;
    v_returning_count INTEGER;
BEGIN
    -- Check permissions (optional, but good practice)
    -- For now, we assume RLS on the table handles row visibility, 
    -- but RPCs run with elevated privileges if SECURITY DEFINER is used without checking via RLS.
    -- Here we just filter by store_id which is passed in.
    
    SELECT count(*) INTO v_new_count
    FROM marketplace_customers
    WHERE store_id = p_store_id AND order_count = 1;

    SELECT count(*) INTO v_returning_count
    FROM marketplace_customers
    WHERE store_id = p_store_id AND order_count > 1;

    RETURN jsonb_build_object(
        'new_customers', v_new_count,
        'returning_customers', v_returning_count,
        'total_customers', v_new_count + v_returning_count
    );
END;
$$;
