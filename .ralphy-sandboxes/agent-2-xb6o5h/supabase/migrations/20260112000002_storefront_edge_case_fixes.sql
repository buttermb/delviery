-- Storefront Edge Case Fixes Migration
-- Adds inventory reservation, coupon system, and cart validation functions
-- Migration: 20260112000002_storefront_edge_case_fixes.sql

-- ============================================================================
-- 1. INVENTORY RESERVATION SYSTEM
-- ============================================================================

-- Add reserved_quantity column to products if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'reserved_quantity'
    ) THEN
        ALTER TABLE public.products ADD COLUMN reserved_quantity INTEGER DEFAULT 0;
    END IF;
END $$;

-- Inventory reservations table (tracks who reserved what)
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    session_id TEXT NOT NULL, -- Browser session or cart ID
    quantity INTEGER NOT NULL DEFAULT 1,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
    order_id UUID, -- Set when order is completed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product ON public.inventory_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_session ON public.inventory_reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires ON public.inventory_reservations(expires_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon (guest checkout)
CREATE POLICY "Allow reservation inserts" ON public.inventory_reservations
    FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (true);

CREATE POLICY "Allow reading own reservations" ON public.inventory_reservations
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

-- Function to reserve inventory
CREATE OR REPLACE FUNCTION public.reserve_inventory(
    p_product_id UUID,
    p_store_id UUID,
    p_session_id TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available INTEGER;
    v_reservation_id UUID;
BEGIN
    -- Get current available stock (total - reserved)
    SELECT COALESCE(
        (SELECT SUM(current_quantity)::integer FROM public.inventory_batches WHERE product_id = p_product_id),
        CASE WHEN p.in_stock THEN 100 ELSE 0 END
    ) - COALESCE(p.reserved_quantity, 0) INTO v_available
    FROM public.products p
    WHERE p.id = p_product_id;
    
    IF v_available IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;
    
    IF v_available < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient stock',
            'available', v_available,
            'requested', p_quantity
        );
    END IF;
    
    -- Cancel any existing reservations for this session+product
    UPDATE public.inventory_reservations 
    SET status = 'cancelled'
    WHERE session_id = p_session_id 
    AND product_id = p_product_id 
    AND status = 'active';
    
    -- Create new reservation
    INSERT INTO public.inventory_reservations (product_id, store_id, session_id, quantity)
    VALUES (p_product_id, p_store_id, p_session_id, p_quantity)
    RETURNING id INTO v_reservation_id;
    
    -- Update reserved quantity on product
    UPDATE public.products 
    SET reserved_quantity = COALESCE(reserved_quantity, 0) + p_quantity
    WHERE id = p_product_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'reservation_id', v_reservation_id,
        'expires_at', NOW() + INTERVAL '15 minutes'
    );
END;
$$;

-- Function to complete reservation (convert to order)
CREATE OR REPLACE FUNCTION public.complete_reservation(
    p_session_id TEXT,
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark reservations as completed
    UPDATE public.inventory_reservations 
    SET status = 'completed', order_id = p_order_id
    WHERE session_id = p_session_id AND status = 'active';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Deduct from actual stock (reserved_quantity stays as-is, actual stock goes down)
    UPDATE public.products p
    SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - r.total_qty)
    FROM (
        SELECT product_id, SUM(quantity) as total_qty 
        FROM public.inventory_reservations 
        WHERE session_id = p_session_id AND status = 'completed' AND order_id = p_order_id
        GROUP BY product_id
    ) r
    WHERE p.id = r.product_id;
    
    RETURN jsonb_build_object('success', true, 'reservations_completed', v_count);
END;
$$;

-- Function to release expired reservations (called by cron)
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Release reserved quantities for expired reservations
    UPDATE public.products p
    SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - r.total_qty)
    FROM (
        SELECT product_id, SUM(quantity) as total_qty 
        FROM public.inventory_reservations 
        WHERE status = 'active' AND expires_at < NOW()
        GROUP BY product_id
    ) r
    WHERE p.id = r.product_id;
    
    -- Mark reservations as expired
    UPDATE public.inventory_reservations 
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reserve_inventory(UUID, UUID, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_reservation(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_reservations() TO service_role;

-- ============================================================================
-- 2. COUPON/PROMO CODE SYSTEM
-- ============================================================================

-- Coupons table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS public.storefront_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
    discount_value NUMERIC(10,2) NOT NULL, -- Percentage (0-100) or fixed amount
    minimum_order_amount NUMERIC(10,2) DEFAULT 0,
    maximum_discount NUMERIC(10,2), -- Cap for percentage discounts
    usage_limit INTEGER, -- NULL = unlimited
    usage_count INTEGER DEFAULT 0,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
    applicable_product_ids UUID[],
    applicable_categories TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_storefront_coupons_store ON public.storefront_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_storefront_coupons_code ON public.storefront_coupons(code);

-- Enable RLS
ALTER TABLE public.storefront_coupons ENABLE ROW LEVEL SECURITY;

-- Allow reading coupons for validation
CREATE POLICY "Allow reading store coupons" ON public.storefront_coupons
    FOR SELECT TO anon, authenticated, service_role
    USING (is_active = true);

-- Function to validate and apply coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_store_id UUID,
    p_code TEXT,
    p_subtotal NUMERIC,
    p_cart_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coupon RECORD;
    v_discount NUMERIC;
    v_applicable_total NUMERIC;
BEGIN
    -- Find coupon
    SELECT * INTO v_coupon
    FROM public.storefront_coupons
    WHERE store_id = p_store_id 
    AND UPPER(code) = UPPER(p_code)
    AND is_active = true;
    
    IF v_coupon IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon code');
    END IF;
    
    -- Check dates
    IF v_coupon.starts_at IS NOT NULL AND NOW() < v_coupon.starts_at THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon not yet active');
    END IF;
    
    IF v_coupon.expires_at IS NOT NULL AND NOW() > v_coupon.expires_at THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon has expired');
    END IF;
    
    -- Check usage limit
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon usage limit reached');
    END IF;
    
    -- Check minimum order
    IF p_subtotal < v_coupon.minimum_order_amount THEN
        RETURN jsonb_build_object(
            'valid', false, 
            'error', 'Minimum order amount not met',
            'minimum_required', v_coupon.minimum_order_amount
        );
    END IF;
    
    -- Calculate discount
    v_applicable_total := p_subtotal; -- TODO: Filter by applicable products if needed
    
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := v_applicable_total * (v_coupon.discount_value / 100);
        IF v_coupon.maximum_discount IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_coupon.maximum_discount);
        END IF;
    ELSIF v_coupon.discount_type = 'fixed_amount' THEN
        v_discount := LEAST(v_coupon.discount_value, v_applicable_total);
    ELSIF v_coupon.discount_type = 'free_shipping' THEN
        v_discount := 0; -- Handled separately in checkout
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'calculated_discount', ROUND(v_discount, 2),
        'free_shipping', v_coupon.discount_type = 'free_shipping'
    );
END;
$$;

-- Function to redeem coupon (increment usage)
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_coupon_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.storefront_coupons 
    SET usage_count = usage_count + 1
    WHERE id = p_coupon_id;
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(UUID, TEXT, NUMERIC, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(UUID) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. CART VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_cart_items(
    p_store_id UUID,
    p_items JSONB -- Array of {product_id, quantity, price}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_product RECORD;
    v_issues JSONB := '[]'::jsonb;
    v_valid_items JSONB := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER, price NUMERIC)
    LOOP
        SELECT 
            p.id,
            p.name,
            COALESCE(mps.custom_price, p.price) as current_price,
            COALESCE(mps.is_visible, true) as is_visible,
            COALESCE(p.in_stock, true) as in_stock,
            COALESCE(
                (SELECT SUM(current_quantity)::integer FROM public.inventory_batches WHERE product_id = p.id),
                CASE WHEN p.in_stock THEN 100 ELSE 0 END
            ) - COALESCE(p.reserved_quantity, 0) as available_quantity
        INTO v_product
        FROM public.products p
        LEFT JOIN public.marketplace_product_settings mps ON mps.product_id = p.id AND mps.store_id = p_store_id
        WHERE p.id = v_item.product_id;
        
        IF v_product IS NULL THEN
            v_issues := v_issues || jsonb_build_object(
                'product_id', v_item.product_id,
                'issue', 'product_deleted',
                'message', 'Product no longer available'
            );
            CONTINUE;
        END IF;
        
        IF NOT v_product.is_visible THEN
            v_issues := v_issues || jsonb_build_object(
                'product_id', v_item.product_id,
                'issue', 'product_hidden',
                'message', 'Product is no longer available'
            );
            CONTINUE;
        END IF;
        
        IF v_product.available_quantity <= 0 THEN
            v_issues := v_issues || jsonb_build_object(
                'product_id', v_item.product_id,
                'issue', 'out_of_stock',
                'message', v_product.name || ' is out of stock'
            );
            CONTINUE;
        END IF;
        
        IF v_product.available_quantity < v_item.quantity THEN
            v_issues := v_issues || jsonb_build_object(
                'product_id', v_item.product_id,
                'issue', 'insufficient_stock',
                'message', 'Only ' || v_product.available_quantity || ' available',
                'available', v_product.available_quantity
            );
        END IF;
        
        IF v_item.price != v_product.current_price THEN
            v_issues := v_issues || jsonb_build_object(
                'product_id', v_item.product_id,
                'issue', 'price_changed',
                'message', 'Price updated to $' || v_product.current_price,
                'old_price', v_item.price,
                'new_price', v_product.current_price
            );
        END IF;
        
        v_valid_items := v_valid_items || jsonb_build_object(
            'product_id', v_item.product_id,
            'name', v_product.name,
            'quantity', LEAST(v_item.quantity, v_product.available_quantity),
            'price', v_product.current_price,
            'in_stock', v_product.in_stock
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'valid', jsonb_array_length(v_issues) = 0,
        'issues', v_issues,
        'validated_items', v_valid_items
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_cart_items(UUID, JSONB) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. STORE SETTINGS (minimum order, etc)
-- ============================================================================

-- Add minimum_order_amount to marketplace_stores if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'marketplace_stores' 
        AND column_name = 'minimum_order_amount'
    ) THEN
        ALTER TABLE public.marketplace_stores ADD COLUMN minimum_order_amount NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- Comment
COMMENT ON TABLE public.inventory_reservations IS 'Tracks temporary inventory holds during checkout to prevent overselling';
COMMENT ON TABLE public.storefront_coupons IS 'Promotional coupon codes for storefront discounts';
COMMENT ON FUNCTION public.validate_cart_items IS 'Validates cart items against current stock, prices, and visibility';
