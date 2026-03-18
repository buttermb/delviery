-- Fix activity_logs table missing tenant_id
-- Based on audit finding 1.2

DO $$ 
BEGIN
  -- Check if tenant_id exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.activity_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON public.activity_logs(tenant_id);
  END IF;
END $$;

