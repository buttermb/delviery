-- Migration: Create register_sessions table for POS register open/close tracking
-- Epic: floraiq-qkq - Payments & POS

-- Create register_sessions table
CREATE TABLE IF NOT EXISTS public.register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opening_float DECIMAL NOT NULL DEFAULT 0,
  closing_amount DECIMAL,
  expected_amount DECIMAL,
  variance DECIMAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.register_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_register_sessions_tenant_id ON public.register_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_register_sessions_user_id ON public.register_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_register_sessions_status ON public.register_sessions(status);
CREATE INDEX IF NOT EXISTS idx_register_sessions_opened_at ON public.register_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_register_sessions_tenant_user ON public.register_sessions(tenant_id, user_id);

-- RLS Policy: Tenant users can view register sessions in their tenant (admins see all, users see own)
CREATE POLICY "Users can view register sessions"
  ON public.register_sessions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = register_sessions.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'owner')
      )
    )
  );

-- RLS Policy: Users can insert register sessions for themselves in their tenant
CREATE POLICY "Users can insert register sessions"
  ON public.register_sessions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own sessions; admins can update any in their tenant
CREATE POLICY "Users can update register sessions"
  ON public.register_sessions
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = register_sessions.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'owner')
      )
    )
  );

-- RLS Policy: Only admins can delete register sessions in their tenant
CREATE POLICY "Admins can delete register sessions"
  ON public.register_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = register_sessions.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Add comments
COMMENT ON TABLE public.register_sessions IS 'POS register sessions tracking open/close with cash reconciliation';
COMMENT ON COLUMN public.register_sessions.opening_float IS 'Starting cash amount when register was opened';
COMMENT ON COLUMN public.register_sessions.closing_amount IS 'Actual cash amount counted at register close';
COMMENT ON COLUMN public.register_sessions.expected_amount IS 'Expected cash amount based on transactions during session';
COMMENT ON COLUMN public.register_sessions.variance IS 'Difference between closing_amount and expected_amount';
COMMENT ON COLUMN public.register_sessions.status IS 'Session status: open (register active), closed (register reconciled)';
