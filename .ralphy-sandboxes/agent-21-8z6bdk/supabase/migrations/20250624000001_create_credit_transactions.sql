-- ============================================================================
-- CREDIT TRANSACTIONS TABLE
-- Tracks all credit movements (purchases, usage, refunds, etc.) per user/tenant
-- Note: This migration is idempotent - skips if table already exists with different schema
-- ============================================================================

DO $$
BEGIN
  -- Only create table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') THEN
    CREATE TABLE public.credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN (
        'purchase', 'usage', 'refund', 'expiration',
        'bonus', 'adjustment', 'transfer_in', 'transfer_out'
      )),
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      reference_type TEXT CHECK (reference_type IN (
        'order', 'subscription', 'promotion', 'admin_adjustment', 'gift'
      )),
      reference_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Comments
    COMMENT ON TABLE public.credit_transactions IS 'Ledger of all credit movements per user/tenant';

    -- Indexes
    CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
    CREATE INDEX idx_credit_transactions_tenant_id ON public.credit_transactions(tenant_id);
    CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(type);
    CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
    CREATE INDEX idx_credit_transactions_user_tenant ON public.credit_transactions(user_id, tenant_id);

    -- RLS
    ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

    -- Policies
    CREATE POLICY "Users can view own credit transactions"
      ON public.credit_transactions FOR SELECT
      USING (user_id = auth.uid());

    CREATE POLICY "Tenant admins view tenant credit transactions"
      ON public.credit_transactions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.tenant_users
          WHERE tenant_users.id = auth.uid()
            AND tenant_users.tenant_id = credit_transactions.tenant_id
            AND tenant_users.role IN ('owner', 'admin')
        )
      );

    CREATE POLICY "Service role inserts credit transactions"
      ON public.credit_transactions FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tenant_users
          WHERE tenant_users.id = auth.uid()
            AND tenant_users.tenant_id = credit_transactions.tenant_id
            AND tenant_users.role IN ('owner', 'admin')
        )
      );

    CREATE POLICY "Super admins manage all credit transactions"
      ON public.credit_transactions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.super_admin_users
          WHERE id = auth.uid()::text::uuid
        )
      );

    RAISE NOTICE 'Created credit_transactions table with full schema';
  ELSE
    RAISE NOTICE 'credit_transactions table already exists - skipping creation';
  END IF;
END;
$$;
