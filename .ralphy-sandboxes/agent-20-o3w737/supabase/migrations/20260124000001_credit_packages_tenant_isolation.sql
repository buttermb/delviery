-- ============================================================================
-- CREDIT PACKAGES TABLE - TENANT ISOLATION & ENHANCED SCHEMA
-- ============================================================================
-- Adds tenant_id for multi-tenant isolation, purchase limits, validity windows,
-- and featured/currency support to the credit_packages table.
-- ============================================================================

-- Add new columns to existing credit_packages table
ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS credit_amount INTEGER,
ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_purchases_per_user INTEGER,
ADD COLUMN IF NOT EXISTS total_purchase_limit INTEGER,
ADD COLUMN IF NOT EXISTS current_purchases INTEGER DEFAULT 0;

-- Backfill credit_amount from existing credits column
UPDATE public.credit_packages
SET credit_amount = credits
WHERE credit_amount IS NULL;

-- Now make tenant_id NOT NULL and credit_amount NOT NULL with checks
-- First, set a default tenant for existing rows (they were global packages)
-- We'll leave tenant_id nullable for now if there are existing rows without tenants
-- and add the constraint only for new rows via a check

-- Add CHECK constraints for credit_amount and price_cents
ALTER TABLE public.credit_packages
ADD CONSTRAINT credit_packages_credit_amount_positive CHECK (credit_amount > 0),
ADD CONSTRAINT credit_packages_price_cents_non_negative CHECK (price_cents >= 0),
ADD CONSTRAINT credit_packages_current_purchases_non_negative CHECK (current_purchases >= 0);

-- Make credit_amount NOT NULL after backfill
ALTER TABLE public.credit_packages
ALTER COLUMN credit_amount SET NOT NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Composite index for tenant + active status queries
CREATE INDEX IF NOT EXISTS idx_credit_packages_tenant_is_active
  ON public.credit_packages(tenant_id, is_active);

-- Index for featured packages
CREATE INDEX IF NOT EXISTS idx_credit_packages_featured
  ON public.credit_packages(is_featured) WHERE is_featured = true;

-- Index for validity window queries
CREATE INDEX IF NOT EXISTS idx_credit_packages_validity
  ON public.credit_packages(valid_from, valid_until)
  WHERE valid_from IS NOT NULL OR valid_until IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Tenant users can view active packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Tenant admins can manage packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Public can view active packages" ON public.credit_packages;

-- Tenant users can view their own tenant's active packages
CREATE POLICY "Tenant users can view active packages"
  ON public.credit_packages
  FOR SELECT
  USING (
    is_active = true
    AND (
      tenant_id IS NULL  -- Global packages visible to all
      OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Tenant admins can manage their own packages
CREATE POLICY "Tenant admins can manage packages"
  ON public.credit_packages
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid()
      AND tenant_id = credit_packages.tenant_id
      AND role IN ('admin', 'owner')
    )
  );

-- Super admins can manage all packages
DROP POLICY IF EXISTS "Super admins manage all credit packages" ON public.credit_packages;
CREATE POLICY "Super admins manage all credit packages"
  ON public.credit_packages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Reuse existing update_updated_at function or create if not exists
CREATE OR REPLACE FUNCTION public.update_credit_packages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_credit_packages_updated_at ON public.credit_packages;
CREATE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_packages_updated_at();
