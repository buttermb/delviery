-- Add feature_toggles JSONB column to tenants table
-- This stores per-tenant feature toggle overrides that merge with FEATURE_TOGGLE_DEFAULTS
-- The existing 'features' column is used for plan-level features by the super admin;
-- this column is for tenant-admin self-service toggles.
--
-- NOTE: If the 'features' column is sufficient, this migration can be skipped.
-- The useTenantFeatureToggles hook reads from 'feature_toggles' first, then falls back to 'features'.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS feature_toggles JSONB DEFAULT '{}'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN public.tenants.feature_toggles IS 'Tenant-managed feature toggle overrides. Merged with FEATURE_TOGGLE_DEFAULTS at runtime.';
