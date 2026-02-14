-- Add tenant_id column to disposable_menus table
-- This enables proper multi-tenant isolation for menu orders

DO $$
BEGIN
  -- Check if tenant_id column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'disposable_menus'
      AND column_name = 'tenant_id'
  ) THEN
    -- Add tenant_id column with foreign key constraint
    ALTER TABLE public.disposable_menus
    ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX idx_disposable_menus_tenant ON public.disposable_menus(tenant_id);

    RAISE NOTICE 'Added tenant_id column to disposable_menus';
  ELSE
    RAISE NOTICE 'tenant_id column already exists on disposable_menus';
  END IF;
END $$;

-- Backfill tenant_id from created_by user's account
-- This populates tenant_id for existing menus
UPDATE public.disposable_menus dm
SET tenant_id = a.tenant_id
FROM public.accounts a
WHERE dm.created_by = a.user_id
  AND dm.tenant_id IS NULL;

-- Report how many rows were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled tenant_id for % existing menus', updated_count;
END $$;
