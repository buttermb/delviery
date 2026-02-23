-- Add purchase_limits column to marketplace_stores
-- Enables stores to set regulatory compliance limits on orders

ALTER TABLE public.marketplace_stores
ADD COLUMN IF NOT EXISTS purchase_limits JSONB DEFAULT NULL;

COMMENT ON COLUMN public.marketplace_stores.purchase_limits IS 'Purchase limit configuration for regulatory compliance: {enabled: boolean, max_per_order: number|null, max_daily: number|null, max_weekly: number|null}';
