-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- TENANTS TABLE - stripe_customer_id (may already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE public.tenants ADD COLUMN stripe_customer_id VARCHAR(255);
    END IF;
END $$;

-- SUBSCRIPTION_PLANS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'description') THEN
        ALTER TABLE public.subscription_plans ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'display_name') THEN
        ALTER TABLE public.subscription_plans ADD COLUMN display_name VARCHAR(100);
        UPDATE public.subscription_plans SET display_name = INITCAP(name) WHERE display_name IS NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscription_plans' AND column_name = 'price_monthly') THEN
        ALTER TABLE public.subscription_plans ADD COLUMN price_monthly DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;