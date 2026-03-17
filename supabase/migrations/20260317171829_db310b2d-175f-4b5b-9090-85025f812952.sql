
-- Create driver_activity_log table
CREATE TABLE IF NOT EXISTS public.driver_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_tenant_id ON public.driver_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_driver_id ON public.driver_activity_log(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_event_type ON public.driver_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_created_at ON public.driver_activity_log(created_at);

-- Enable RLS
ALTER TABLE public.driver_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant isolation for authenticated users
CREATE POLICY "Tenant isolation for driver_activity_log"
  ON public.driver_activity_log FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id 
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
    )
  );

-- RLS: Allow service role (edge functions) to insert
CREATE POLICY "Service role can insert driver_activity_log"
  ON public.driver_activity_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS: Allow service role to select
CREATE POLICY "Service role can select driver_activity_log"
  ON public.driver_activity_log FOR SELECT
  TO service_role
  USING (true);
