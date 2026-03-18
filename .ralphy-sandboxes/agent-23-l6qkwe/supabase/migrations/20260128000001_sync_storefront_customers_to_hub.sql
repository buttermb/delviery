-- ============================================================================
-- Sync Storefront Customers to Customer Hub
--
-- This migration creates a synchronization mechanism between marketplace_customers
-- (storefront signups) and the customers table (admin customer hub).
--
-- When a customer signs up or places an order on the storefront, their record
-- is automatically synced to the admin customer hub for unified CRM management.
-- ============================================================================

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION sync_marketplace_customer_to_customers()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_account_id UUID;
  v_existing_customer_id UUID;
BEGIN
  -- Get tenant_id from the store's marketplace_profiles
  SELECT mp.tenant_id INTO v_tenant_id
  FROM public.marketplace_profiles mp
  WHERE mp.id = NEW.store_id;

  -- Exit if no tenant found (shouldn't happen but safety check)
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get account_id for this tenant
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- If no account, try to get any account (legacy support)
  IF v_account_id IS NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    JOIN public.tenants t ON t.id = v_tenant_id
    WHERE a.id IS NOT NULL
    LIMIT 1;
  END IF;

  -- If still no account, we can't sync - exit gracefully
  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if customer already exists by email + tenant_id
  SELECT id INTO v_existing_customer_id
  FROM public.customers
  WHERE tenant_id = v_tenant_id
    AND email = lower(NEW.email)
    AND deleted_at IS NULL;

  IF v_existing_customer_id IS NOT NULL THEN
    -- Update existing customer with latest info from storefront
    UPDATE public.customers
    SET
      first_name = COALESCE(NEW.first_name, first_name),
      last_name = COALESCE(NEW.last_name, last_name),
      phone = COALESCE(NEW.phone, phone),
      updated_at = NOW()
    WHERE id = v_existing_customer_id;
  ELSE
    -- Insert new customer
    INSERT INTO public.customers (
      account_id,
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      customer_type,
      status,
      loyalty_points,
      loyalty_tier,
      total_spent,
      referral_source,
      created_at,
      updated_at
    ) VALUES (
      v_account_id,
      v_tenant_id,
      COALESCE(NEW.first_name, 'Guest'),
      COALESCE(NEW.last_name, ''),
      lower(NEW.email),
      NEW.phone,
      'recreational',  -- Default type for storefront customers
      'active',
      0,              -- Starting loyalty points
      'bronze',       -- Starting tier
      0,              -- Starting total spent
      'storefront',   -- Track that this came from storefront
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create trigger on marketplace_customers for INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_sync_marketplace_customer ON public.marketplace_customers;

CREATE TRIGGER trigger_sync_marketplace_customer
  AFTER INSERT OR UPDATE ON public.marketplace_customers
  FOR EACH ROW
  EXECUTE FUNCTION sync_marketplace_customer_to_customers();

-- 3. Create manual sync function for admin to trigger sync of existing customers
CREATE OR REPLACE FUNCTION sync_all_marketplace_customers_to_hub(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  synced_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_synced INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
  v_customer RECORD;
  v_tenant_id UUID;
  v_account_id UUID;
  v_existing_customer_id UUID;
BEGIN
  FOR v_customer IN
    SELECT mc.*
    FROM public.marketplace_customers mc
    WHERE (p_store_id IS NULL OR mc.store_id = p_store_id)
  LOOP
    BEGIN
      -- Get tenant_id from the store
      SELECT mp.tenant_id INTO v_tenant_id
      FROM public.marketplace_profiles mp
      WHERE mp.id = v_customer.store_id;

      IF v_tenant_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Get account_id
      SELECT id INTO v_account_id
      FROM public.accounts
      WHERE tenant_id = v_tenant_id
      LIMIT 1;

      IF v_account_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Check if exists
      SELECT id INTO v_existing_customer_id
      FROM public.customers
      WHERE tenant_id = v_tenant_id
        AND email = lower(v_customer.email)
        AND deleted_at IS NULL;

      IF v_existing_customer_id IS NOT NULL THEN
        -- Update existing
        UPDATE public.customers
        SET
          first_name = COALESCE(v_customer.first_name, first_name),
          last_name = COALESCE(v_customer.last_name, last_name),
          phone = COALESCE(v_customer.phone, phone),
          updated_at = NOW()
        WHERE id = v_existing_customer_id;
        v_synced := v_synced + 1;
      ELSE
        -- Insert new
        INSERT INTO public.customers (
          account_id,
          tenant_id,
          first_name,
          last_name,
          email,
          phone,
          customer_type,
          status,
          loyalty_points,
          loyalty_tier,
          total_spent,
          referral_source,
          created_at,
          updated_at
        ) VALUES (
          v_account_id,
          v_tenant_id,
          COALESCE(v_customer.first_name, 'Guest'),
          COALESCE(v_customer.last_name, ''),
          lower(v_customer.email),
          v_customer.phone,
          'recreational',
          'active',
          0,
          'bronze',
          0,
          'storefront',
          NOW(),
          NOW()
        );
        v_synced := v_synced + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_synced, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Add link column to track marketplace_customer_id in customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS marketplace_customer_id UUID REFERENCES public.marketplace_customers(id) ON DELETE SET NULL;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_marketplace_customer_id
ON public.customers(marketplace_customer_id)
WHERE marketplace_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_referral_source_storefront
ON public.customers(referral_source)
WHERE referral_source = 'storefront';

-- 6. Update sync function to link marketplace_customer_id
CREATE OR REPLACE FUNCTION sync_marketplace_customer_to_customers()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_account_id UUID;
  v_existing_customer_id UUID;
BEGIN
  -- Get tenant_id from the store's marketplace_profiles
  SELECT mp.tenant_id INTO v_tenant_id
  FROM public.marketplace_profiles mp
  WHERE mp.id = NEW.store_id;

  -- Exit if no tenant found
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get account_id for this tenant
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if customer already exists by email + tenant_id
  SELECT id INTO v_existing_customer_id
  FROM public.customers
  WHERE tenant_id = v_tenant_id
    AND email = lower(NEW.email)
    AND deleted_at IS NULL;

  IF v_existing_customer_id IS NOT NULL THEN
    -- Update existing customer with latest info from storefront
    UPDATE public.customers
    SET
      first_name = COALESCE(NEW.first_name, first_name),
      last_name = COALESCE(NEW.last_name, last_name),
      phone = COALESCE(NEW.phone, phone),
      marketplace_customer_id = NEW.id,
      updated_at = NOW()
    WHERE id = v_existing_customer_id;
  ELSE
    -- Insert new customer with link to marketplace_customer
    INSERT INTO public.customers (
      account_id,
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      customer_type,
      status,
      loyalty_points,
      loyalty_tier,
      total_spent,
      referral_source,
      marketplace_customer_id,
      created_at,
      updated_at
    ) VALUES (
      v_account_id,
      v_tenant_id,
      COALESCE(NEW.first_name, 'Guest'),
      COALESCE(NEW.last_name, ''),
      lower(NEW.email),
      NEW.phone,
      'recreational',
      'active',
      0,
      'bronze',
      0,
      'storefront',
      NEW.id,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check trigger exists:
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'trigger_sync_marketplace_customer';
--
-- Check function exists:
-- SELECT proname FROM pg_proc WHERE proname = 'sync_marketplace_customer_to_customers';
--
-- Test manual sync:
-- SELECT * FROM sync_all_marketplace_customers_to_hub();
-- ============================================================================

COMMENT ON FUNCTION sync_marketplace_customer_to_customers() IS 'Automatically syncs storefront customers to the admin customer hub when they sign up or place an order';
COMMENT ON FUNCTION sync_all_marketplace_customers_to_hub(UUID) IS 'Manually sync all existing marketplace customers to the customer hub. Pass store_id to sync only for a specific store.';
