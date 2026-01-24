-- ============================================================================
-- CREDIT TRANSACTIONS TABLE
-- Tracks all credit movements (purchases, usage, refunds, etc.) per user/tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_transactions (
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

-- Comment on table and key columns
COMMENT ON TABLE public.credit_transactions IS 'Ledger of all credit movements per user/tenant';
COMMENT ON COLUMN public.credit_transactions.type IS 'Transaction type: purchase, usage, refund, expiration, bonus, adjustment, transfer_in, transfer_out';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Credit amount (positive for additions, negative for deductions)';
COMMENT ON COLUMN public.credit_transactions.balance_before IS 'User credit balance before this transaction';
COMMENT ON COLUMN public.credit_transactions.balance_after IS 'User credit balance after this transaction';
COMMENT ON COLUMN public.credit_transactions.reference_type IS 'What entity triggered this transaction';
COMMENT ON COLUMN public.credit_transactions.metadata IS 'Additional data: payment_method, stripe_charge_id, promo_code, etc.';
COMMENT ON COLUMN public.credit_transactions.processed_by IS 'Admin user who processed this transaction (for manual adjustments)';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
  ON public.credit_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_id
  ON public.credit_transactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_type
  ON public.credit_transactions(type);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
  ON public.credit_transactions(created_at DESC);

-- Composite index for common query pattern: user transactions within a tenant
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_tenant
  ON public.credit_transactions(user_id, tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Tenant admins can view all transactions within their tenant
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

-- Only service role (backend) can insert transactions to maintain ledger integrity
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

-- Super admins can view/manage all transactions
CREATE POLICY "Super admins manage all credit transactions"
  ON public.credit_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_users
      WHERE id = auth.uid()::text::uuid
    )
  );
