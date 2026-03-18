-- ============================================================================
-- Fix customer_invoices: add FK to customers, fix RLS policies
-- ============================================================================

-- 1. Add FK from customer_invoices.customer_id to customers.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_customer_invoices_customer'
    AND table_name = 'customer_invoices'
  ) THEN
    -- Only add FK if both tables exist and column exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_invoices') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'customer_id') THEN
      ALTER TABLE public.customer_invoices
        ADD CONSTRAINT fk_customer_invoices_customer
        FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 2. Drop stale RLS policies that use account_id or current_setting
DO $$
BEGIN
  -- Drop account_id-based policies (from 20251105 migration)
  DROP POLICY IF EXISTS "Users can view invoices in their account" ON public.customer_invoices;
  DROP POLICY IF EXISTS "Users can create invoices in their account" ON public.customer_invoices;
  DROP POLICY IF EXISTS "Users can update invoices in their account" ON public.customer_invoices;
  -- Drop current_setting-based policy (from 20251102 migration)
  DROP POLICY IF EXISTS "tenant_isolation_customer_invoices" ON public.customer_invoices;
END $$;

-- 3. Create correct tenant_id-based RLS policies via tenant_users
CREATE POLICY "tenant_select_customer_invoices" ON public.customer_invoices
  FOR SELECT USING (
    tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  );

CREATE POLICY "tenant_insert_customer_invoices" ON public.customer_invoices
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  );

CREATE POLICY "tenant_update_customer_invoices" ON public.customer_invoices
  FOR UPDATE USING (
    tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  );

CREATE POLICY "tenant_delete_customer_invoices" ON public.customer_invoices
  FOR DELETE USING (
    tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  );

-- 4. Ensure missing columns exist (added via dashboard but not tracked in migrations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'issue_date') THEN
    ALTER TABLE public.customer_invoices ADD COLUMN issue_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'amount_paid') THEN
    ALTER TABLE public.customer_invoices ADD COLUMN amount_paid NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'amount_due') THEN
    ALTER TABLE public.customer_invoices ADD COLUMN amount_due NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'line_items') THEN
    ALTER TABLE public.customer_invoices ADD COLUMN line_items JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_invoices' AND column_name = 'updated_at') THEN
    ALTER TABLE public.customer_invoices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 5. Make due_date nullable (code doesn't always provide it)
ALTER TABLE public.customer_invoices ALTER COLUMN due_date DROP NOT NULL;

-- 6. Add draft to status check constraint if not present
DO $$
BEGIN
  -- Drop old constraint and recreate with draft included
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'customer_invoices_status_check'
  ) THEN
    ALTER TABLE public.customer_invoices DROP CONSTRAINT customer_invoices_status_check;
  END IF;
  ALTER TABLE public.customer_invoices
    ADD CONSTRAINT customer_invoices_status_check
    CHECK (status IN ('draft', 'unpaid', 'paid', 'overdue', 'cancelled'));
EXCEPTION
  WHEN others THEN NULL; -- Ignore if constraint already correct
END $$;
