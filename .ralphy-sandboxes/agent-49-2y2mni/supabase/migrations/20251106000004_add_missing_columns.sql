-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================
-- Fixes TypeScript errors for missing properties
-- ============================================================================

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================

-- Ensure stripe_customer_id exists (may already exist from 20251102000000)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE public.tenants 
        ADD COLUMN stripe_customer_id VARCHAR(255);
    END IF;
END $$;

-- Ensure limits and usage JSONB columns exist (should already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'limits'
    ) THEN
        ALTER TABLE public.tenants 
        ADD COLUMN limits JSONB DEFAULT '{
            "customers": 50,
            "menus": 5,
            "products": 100,
            "locations": 3,
            "team_members": 3,
            "storage_gb": 5,
            "api_calls": 10000,
            "sms": 100,
            "emails": 500
        }'::jsonb;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants' 
        AND column_name = 'usage'
    ) THEN
        ALTER TABLE public.tenants 
        ADD COLUMN usage JSONB DEFAULT '{
            "customers": 0,
            "menus": 0,
            "products": 0,
            "locations": 0,
            "team_members": 0,
            "storage_gb": 0,
            "api_calls": 0,
            "sms": 0,
            "emails": 0
        }'::jsonb;
    END IF;
END $$;

-- Ensure white_label JSONB structure includes email/sms branding
DO $$
BEGIN
    -- Update existing rows to include new white_label fields if missing
    UPDATE public.tenants
    SET white_label = COALESCE(white_label, '{}'::jsonb) || 
        jsonb_build_object(
            'emailFrom', COALESCE(white_label->>'emailFrom', NULL),
            'emailLogo', COALESCE(white_label->>'emailLogo', NULL),
            'emailFooter', COALESCE(white_label->>'emailFooter', NULL),
            'smsFrom', COALESCE(white_label->>'smsFrom', NULL)
        )
    WHERE white_label IS NULL 
       OR white_label->>'emailFrom' IS NULL;
END $$;

-- ============================================================================
-- SUBSCRIPTION_PLANS TABLE
-- ============================================================================

-- Verify price_monthly exists (should already exist from 20251104000000)
-- Add description if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_plans' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.subscription_plans 
        ADD COLUMN description TEXT;
    END IF;
END $$;

-- Verify display_name exists (should already exist from 20251104000000)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_plans' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.subscription_plans 
        ADD COLUMN display_name VARCHAR(100);
        
        -- Set display_name from name if null
        UPDATE public.subscription_plans
        SET display_name = INITCAP(name)
        WHERE display_name IS NULL;
    END IF;
END $$;

-- Verify price_monthly exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscription_plans' 
        AND column_name = 'price_monthly'
    ) THEN
        ALTER TABLE public.subscription_plans 
        ADD COLUMN price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- SUPER_ADMIN_USERS TABLE
-- ============================================================================

-- Verify two_factor_enabled exists (should already exist from 20251104000000)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'super_admin_users' 
        AND column_name = 'two_factor_enabled'
    ) THEN
        ALTER TABLE public.super_admin_users 
        ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Comments
COMMENT ON COLUMN public.tenants.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.tenants.limits IS 'JSON object with plan limits: {customers: 50, menus: 5, ...}';
COMMENT ON COLUMN public.tenants.usage IS 'JSON object with current usage: {customers: 10, menus: 2, ...}';
COMMENT ON COLUMN public.tenants.white_label IS 'JSON object with branding: {emailFrom, emailLogo, emailFooter, smsFrom, ...}';
COMMENT ON COLUMN public.subscription_plans.description IS 'Human-readable plan description';
COMMENT ON COLUMN public.subscription_plans.display_name IS 'Display name for UI (e.g., "Professional Plan")';
COMMENT ON COLUMN public.super_admin_users.two_factor_enabled IS 'Whether 2FA is enabled for this admin';

