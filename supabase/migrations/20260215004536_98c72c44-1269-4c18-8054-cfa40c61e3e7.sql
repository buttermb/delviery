
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_expenses_tenant_id ON public.expenses(tenant_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for expenses"
  ON public.expenses FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = 'active'
    )
  );
