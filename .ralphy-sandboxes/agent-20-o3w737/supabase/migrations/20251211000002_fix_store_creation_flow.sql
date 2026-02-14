-- Migration: Fix Store Creation Flow
-- Description: Automates marketplace_profile creation via trigger on tenants table and backfills existing tenants.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_tenant_marketplace_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotency check: Ensure profile doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_profiles WHERE tenant_id = NEW.id) THEN
    INSERT INTO public.marketplace_profiles (
      tenant_id,
      name,
      slug,
      description,
      is_public,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.business_name,
      NEW.slug,
      'Welcome to ' || NEW.business_name,
      true,
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on the tenants table
DROP TRIGGER IF EXISTS on_tenant_created_create_marketplace_profile ON public.tenants;
CREATE TRIGGER on_tenant_created_create_marketplace_profile
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant_marketplace_profile();

-- 3. Backfill existing tenants
-- This anonymous block will run once when the migration is applied
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM public.tenants LOOP
    IF NOT EXISTS (SELECT 1 FROM public.marketplace_profiles WHERE tenant_id = t.id) THEN
      INSERT INTO public.marketplace_profiles (
        tenant_id,
        name,
        slug,
        description,
        is_public,
        created_at,
        updated_at
      ) VALUES (
        t.id,
        t.business_name,
        t.slug,
        'Welcome to ' || t.business_name,
        true,
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
END;
$$;
