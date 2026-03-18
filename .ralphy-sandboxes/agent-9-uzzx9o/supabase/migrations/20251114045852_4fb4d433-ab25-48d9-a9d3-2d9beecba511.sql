-- Create system_metrics table
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_logs table
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to audit_logs if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resource_type') THEN
    ALTER TABLE public.audit_logs ADD COLUMN resource_type TEXT;
    UPDATE public.audit_logs SET resource_type = entity_type WHERE resource_type IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='tenant_id') THEN
    ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='actor_type') THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_type TEXT DEFAULT 'super_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='timestamp') THEN
    ALTER TABLE public.audit_logs ADD COLUMN timestamp TIMESTAMP WITH TIME ZONE;
    UPDATE public.audit_logs SET timestamp = created_at WHERE timestamp IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='metadata') THEN
    ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB;
    UPDATE public.audit_logs SET metadata = details WHERE metadata IS NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON public.system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_logs_tenant ON public.api_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON public.api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON public.api_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type);

-- Insert sample system metrics data
INSERT INTO public.system_metrics (metric_type, value, metadata, timestamp) VALUES
  ('cpu_usage', 45.2, '{"server": "app-1"}', NOW() - INTERVAL '1 hour'),
  ('memory_usage', 62.8, '{"server": "app-1"}', NOW() - INTERVAL '1 hour'),
  ('disk_usage', 78.5, '{"server": "app-1"}', NOW() - INTERVAL '1 hour'),
  ('active_connections', 234, '{"server": "db-1"}', NOW() - INTERVAL '30 minutes'),
  ('response_time', 145, '{"endpoint": "/api/tenants"}', NOW() - INTERVAL '15 minutes')
ON CONFLICT DO NOTHING;

-- Insert sample API logs data
INSERT INTO public.api_logs (endpoint, method, status_code, response_time_ms, tenant_id, timestamp) VALUES
  ('/api/tenants', 'GET', 200, 145, NULL, NOW() - INTERVAL '5 minutes'),
  ('/api/analytics', 'GET', 200, 320, NULL, NOW() - INTERVAL '10 minutes'),
  ('/api/tenants/123', 'PUT', 200, 89, NULL, NOW() - INTERVAL '15 minutes'),
  ('/api/revenue', 'GET', 200, 456, NULL, NOW() - INTERVAL '20 minutes'),
  ('/api/system', 'GET', 200, 78, NULL, NOW() - INTERVAL '25 minutes')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Super admins can view system metrics" ON public.system_metrics
  FOR SELECT USING (true);

CREATE POLICY "Super admins can view API logs" ON public.api_logs
  FOR SELECT USING (true);

CREATE POLICY "System can insert API logs" ON public.api_logs
  FOR INSERT WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.system_metrics IS 'System performance metrics for monitoring';
COMMENT ON TABLE public.api_logs IS 'API request logs for usage tracking';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource being audited';
COMMENT ON COLUMN public.audit_logs.tenant_id IS 'ID of affected tenant';
COMMENT ON COLUMN public.audit_logs.actor_type IS 'Type of actor performing action';
COMMENT ON COLUMN public.audit_logs.timestamp IS 'When the action occurred';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional contextual data';