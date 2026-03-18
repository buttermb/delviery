-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  permissions JSONB DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit_trail table
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions JSONB DEFAULT '[]'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custom_integrations table
CREATE TABLE IF NOT EXISTS public.custom_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events JSONB DEFAULT '[]'::jsonb,
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custom_reports table
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  format TEXT DEFAULT 'csv',
  schedule TEXT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_id ON public.audit_trail(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant_id ON public.automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_integrations_tenant_id ON public.custom_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON public.webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant_id ON public.custom_reports(tenant_id);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys
CREATE POLICY "Tenants can view own api_keys"
  ON public.api_keys FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own api_keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own api_keys"
  ON public.api_keys FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own api_keys"
  ON public.api_keys FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for audit_trail
CREATE POLICY "Tenants can view own audit_trail"
  ON public.audit_trail FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit_trail"
  ON public.audit_trail FOR INSERT
  WITH CHECK (true);

-- RLS Policies for automation_rules
CREATE POLICY "Tenants can view own automation_rules"
  ON public.automation_rules FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own automation_rules"
  ON public.automation_rules FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own automation_rules"
  ON public.automation_rules FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own automation_rules"
  ON public.automation_rules FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for custom_integrations
CREATE POLICY "Tenants can view own custom_integrations"
  ON public.custom_integrations FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own custom_integrations"
  ON public.custom_integrations FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own custom_integrations"
  ON public.custom_integrations FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own custom_integrations"
  ON public.custom_integrations FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for webhooks
CREATE POLICY "Tenants can view own webhooks"
  ON public.webhooks FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own webhooks"
  ON public.webhooks FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own webhooks"
  ON public.webhooks FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own webhooks"
  ON public.webhooks FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for custom_reports
CREATE POLICY "Tenants can view own custom_reports"
  ON public.custom_reports FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can insert own custom_reports"
  ON public.custom_reports FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can update own custom_reports"
  ON public.custom_reports FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can delete own custom_reports"
  ON public.custom_reports FOR DELETE
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.profiles p 
      JOIN public.accounts a ON p.account_id = a.id 
      WHERE p.user_id = auth.uid()
    )
  );

-- Create function to auto-assign tenant_id
CREATE OR REPLACE FUNCTION public.auto_assign_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT a.tenant_id INTO NEW.tenant_id
    FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tenant_id auto-assignment
CREATE TRIGGER auto_assign_api_keys_tenant
  BEFORE INSERT ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

CREATE TRIGGER auto_assign_audit_trail_tenant
  BEFORE INSERT ON public.audit_trail
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

CREATE TRIGGER auto_assign_automation_rules_tenant
  BEFORE INSERT ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

CREATE TRIGGER auto_assign_custom_integrations_tenant
  BEFORE INSERT ON public.custom_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

CREATE TRIGGER auto_assign_webhooks_tenant
  BEFORE INSERT ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

CREATE TRIGGER auto_assign_custom_reports_tenant
  BEFORE INSERT ON public.custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant_id();

-- Create triggers for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_custom_integrations_updated_at
  BEFORE UPDATE ON public.custom_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();