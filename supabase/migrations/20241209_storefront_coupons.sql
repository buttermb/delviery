-- ============================================================================
-- COMPLETELY SKIPPED: MIGRATION TIMELINE VIOLATION
-- ============================================================================
-- This migration (dated 2024-12-09) attempts to create `marketplace_coupons`
-- but references `marketplace_stores` which is not created until 2025-12-09.
--
-- Valid coupon creation is handled in `20251211000004_create_marketplace_coupons.sql`.
-- This file is redundant and breaks the migration chain.
-- ============================================================================
/*
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
*/
