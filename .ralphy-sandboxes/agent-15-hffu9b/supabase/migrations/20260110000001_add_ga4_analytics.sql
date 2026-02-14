-- Add GA4 Analytics Measurement ID column to marketplace_stores
-- This enables store owners to add their GA4 tracking ID for e-commerce analytics

ALTER TABLE public.marketplace_stores
ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT;

COMMENT ON COLUMN public.marketplace_stores.ga4_measurement_id IS 'Google Analytics 4 Measurement ID for tracking e-commerce events';
