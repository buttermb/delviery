-- ============================================================================
-- COMPLETE TENANT ISOLATION SYSTEM
-- ============================================================================
-- This migration ensures full tenant isolation:
-- 1. Automatic tenant creation trigger (fallback)
-- 2. Comprehensive RLS policies for all tenant-aware tables
-- 3. Helper functions for tenant validation
-- ============================================================================

-- ============================================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's tenant_id(s) - returns array for users with multiple tenants
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS UUID[] 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(tenant_id)
  FROM public.tenant_users
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND status = 'active'
  );
$$;

-- Function to get primary tenant_id (first active tenant)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- ============================================================================
-- PART 2: AUTOMATIC TENANT CREATION TRIGGER (FALLBACK)
-- ============================================================================
-- This trigger creates a tenant automatically when a new user signs up
-- if they don't already have one. This is a safety net - the primary
-- tenant creation should happen in the tenant-signup edge function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_tenant_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  user_email TEXT;
  user_name TEXT;
  tenant_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  -- Only run if user doesn't already have a tenant
  IF EXISTS (
    SELECT 1 FROM public.tenant_users WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get user metadata
  user_email := COALESCE(NEW.email, 'user-' || NEW.id::text || '@example.com');
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  -- Generate unique slug
  tenant_slug := LOWER(REGEXP_REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'business_name',
      user_name
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  
  -- Ensure slug is unique
  slug_exists := TRUE;
  WHILE slug_exists LOOP
    SELECT EXISTS(SELECT 1 FROM public.tenants WHERE slug = tenant_slug) INTO slug_exists;
    IF slug_exists THEN
      tenant_slug := tenant_slug || '-' || SUBSTRING(NEW.id::text, 1, 8);
    END IF;
  END LOOP;

  -- Create tenant
  INSERT INTO public.tenants (
    business_name,
    slug,
    owner_email,
    owner_name,
    subscription_plan,
    subscription_status,
    trial_ends_at,
    limits,
    usage,
    features,
    mrr
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', user_name || '''s Business'),
    tenant_slug,
    user_email,
    user_name,
    'starter',
    'trial',
    NOW() + INTERVAL '14 days',
    '{"customers": 50, "menus": 3, "products": 100, "locations": 2, "users": 3}'::jsonb,
    '{"customers": 0, "menus": 0, "products": 0, "locations": 0, "users": 1}'::jsonb,
    '{"api_access": false, "custom_branding": false, "white_label": false, "advanced_analytics": false, "sms_enabled": false}'::jsonb,
    99
  )
  RETURNING id INTO new_tenant_id;

  -- Link user to tenant as owner
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    email,
    name,
    role,
    status,
    email_verified,
    accepted_at
  ) VALUES (
    new_tenant_id,
    NEW.id,
    user_email,
    user_name,
    'owner',
    'active',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Create trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created_create_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_create_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tenant_creation();

-- ============================================================================
-- PART 3: ENSURE ALL TABLES HAVE TENANT_ID AND RLS
-- ============================================================================

DO $$
DECLARE
  table_record RECORD;
  table_name TEXT;
  has_tenant_id BOOLEAN;
  has_rls_enabled BOOLEAN;
  policy_exists BOOLEAN;
BEGIN
  -- Loop through all public tables
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        'tenants',
        'tenant_users',
        'subscription_events',
        'usage_events',
        'feature_flags',
        'tenant_feature_overrides',
        '_prisma_migrations',
        'schema_migrations'
      )
  LOOP
    table_name := table_record.tablename;

    -- Check if tenant_id column exists
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = table_record.tablename
        AND column_name = 'tenant_id'
    ) INTO has_tenant_id;

    -- Check if RLS is enabled
    SELECT relrowsecurity
    INTO has_rls_enabled
    FROM pg_class
    WHERE relname = table_record.tablename
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    -- Add tenant_id if missing (for tenant-aware tables)
    -- Skip tables that shouldn't have tenant_id (like junction tables that inherit from parent)
    IF NOT has_tenant_id AND table_name NOT LIKE '%_tenant_%' THEN
      -- Check if table has foreign keys to tenant-aware tables
      -- If it does, it might inherit tenant_id through relationships
      -- For now, we'll add it to all tables except explicitly excluded ones
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', table_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON %I(tenant_id)', table_name, table_name);
        RAISE NOTICE 'Added tenant_id to table: %', table_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant_id to table %: %', table_name, SQLERRM;
      END;
    END IF;

    -- Enable RLS if not enabled
    IF NOT has_rls_enabled THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        RAISE NOTICE 'Enabled RLS on table: %', table_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not enable RLS on table %: %', table_name, SQLERRM;
      END;
    END IF;

    -- Create tenant isolation policy if tenant_id exists and policy doesn't exist
    IF has_tenant_id OR EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = table_record.tablename
        AND column_name = 'tenant_id'
    ) THEN
      SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = table_record.tablename
          AND policyname = 'tenant_isolation_' || table_record.tablename
      ) INTO policy_exists;

      IF NOT policy_exists THEN
        BEGIN
          EXECUTE format(
            'CREATE POLICY tenant_isolation_%I ON %I FOR ALL ' ||
            'USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = ''active'')) ' ||
            'WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = ''active''))',
            table_name, table_name
          );
          RAISE NOTICE 'Created tenant isolation policy for table: %', table_name;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Could not create policy for table %: %', table_name, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 4: SPECIFIC TABLE POLICIES (for tables that need custom logic)
-- ============================================================================

-- Ensure tenant_users has proper policies
DROP POLICY IF EXISTS "Users can view own tenant_users" ON public.tenant_users;
CREATE POLICY "Users can view own tenant_users"
  ON public.tenant_users FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own tenant_users" ON public.tenant_users;
CREATE POLICY "Users can update own tenant_users"
  ON public.tenant_users FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================================
-- PART 5: COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.get_user_tenant_ids() IS 'Returns array of all tenant_ids for current user';
COMMENT ON FUNCTION public.user_belongs_to_tenant(UUID) IS 'Checks if current user belongs to specified tenant';
COMMENT ON FUNCTION public.get_user_tenant_id() IS 'Returns primary tenant_id for current user';
COMMENT ON FUNCTION public.handle_new_user_tenant_creation() IS 'Automatically creates tenant when new user signs up (fallback)';

