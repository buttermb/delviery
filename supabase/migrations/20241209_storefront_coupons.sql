-- ============================================
-- STOREFRONT COUPONS TABLE
-- Coupon/discount codes for marketplace stores
-- ============================================

-- Create marketplace_coupons table if not exists
CREATE TABLE IF NOT EXISTS public.marketplace_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    minimum_order DECIMAL(10,2),
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique code per store
    CONSTRAINT unique_coupon_code_per_store UNIQUE (store_id, code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_store_id ON public.marketplace_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_code ON public.marketplace_coupons(code);
CREATE INDEX IF NOT EXISTS idx_marketplace_coupons_active ON public.marketplace_coupons(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Stores can manage their own coupons
CREATE POLICY "Stores can view own coupons"
    ON public.marketplace_coupons
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.marketplace_stores ms
            WHERE ms.id = marketplace_coupons.store_id
            AND ms.tenant_id = (
                SELECT tenant_id FROM public.tenant_admin_profiles
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Stores can insert own coupons"
    ON public.marketplace_coupons
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.marketplace_stores ms
            WHERE ms.id = marketplace_coupons.store_id
            AND ms.tenant_id = (
                SELECT tenant_id FROM public.tenant_admin_profiles
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Stores can update own coupons"
    ON public.marketplace_coupons
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.marketplace_stores ms
            WHERE ms.id = marketplace_coupons.store_id
            AND ms.tenant_id = (
                SELECT tenant_id FROM public.tenant_admin_profiles
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Stores can delete own coupons"
    ON public.marketplace_coupons
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.marketplace_stores ms
            WHERE ms.id = marketplace_coupons.store_id
            AND ms.tenant_id = (
                SELECT tenant_id FROM public.tenant_admin_profiles
                WHERE user_id = auth.uid()
            )
        )
    );

-- Public can validate coupons (for checkout)
CREATE POLICY "Public can validate coupons"
    ON public.marketplace_coupons
    FOR SELECT
    USING (is_active = true);

-- Function to validate and apply coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(
    p_store_id UUID,
    p_code TEXT,
    p_cart_total DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon RECORD;
    v_discount DECIMAL;
BEGIN
    -- Find the coupon
    SELECT * INTO v_coupon
    FROM public.marketplace_coupons
    WHERE store_id = p_store_id
    AND code = UPPER(p_code)
    AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon code');
    END IF;
    
    -- Check expiration
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon has expired');
    END IF;
    
    -- Check max uses
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon has reached maximum uses');
    END IF;
    
    -- Check minimum order
    IF v_coupon.minimum_order IS NOT NULL AND p_cart_total < v_coupon.minimum_order THEN
        RETURN jsonb_build_object(
            'valid', false, 
            'error', format('Minimum order of $%.2f required', v_coupon.minimum_order)
        );
    END IF;
    
    -- Calculate discount
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := p_cart_total * (v_coupon.discount_value / 100);
    ELSE
        v_discount := LEAST(v_coupon.discount_value, p_cart_total);
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'calculated_discount', ROUND(v_discount, 2)
    );
END;
$$;

-- Function to increment coupon usage
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.marketplace_coupons
    SET uses_count = uses_count + 1,
        updated_at = NOW()
    WHERE id = p_coupon_id;
END;
$$;

-- Add coupon_id to marketplace_orders if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'marketplace_orders'
        AND column_name = 'coupon_id'
    ) THEN
        ALTER TABLE public.marketplace_orders
        ADD COLUMN coupon_id UUID REFERENCES public.marketplace_coupons(id),
        ADD COLUMN coupon_discount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_coupon TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage TO authenticated;

COMMENT ON TABLE public.marketplace_coupons IS 'Discount coupons for marketplace stores';
COMMENT ON FUNCTION public.validate_coupon IS 'Validates a coupon code and calculates discount';
