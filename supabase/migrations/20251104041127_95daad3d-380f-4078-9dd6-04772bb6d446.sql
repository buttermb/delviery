-- Create customer_activities table for CRM activity tracking
CREATE TABLE IF NOT EXISTS public.customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'order', 'payment', 'task')),
  title text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Create customer_communications table for CRM communication tracking
CREATE TABLE IF NOT EXISTS public.customer_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  communication_type text NOT NULL CHECK (communication_type IN ('email', 'sms', 'call', 'chat', 'meeting')),
  subject text,
  body text,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_activities
CREATE POLICY "Tenants can view own customer activities"
  ON public.customer_activities FOR SELECT
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can create customer activities"
  ON public.customer_activities FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can update own customer activities"
  ON public.customer_activities FOR UPDATE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can delete own customer activities"
  ON public.customer_activities FOR DELETE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

-- RLS Policies for customer_communications
CREATE POLICY "Tenants can view own communications"
  ON public.customer_communications FOR SELECT
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can create communications"
  ON public.customer_communications FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can update own communications"
  ON public.customer_communications FOR UPDATE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can delete own communications"
  ON public.customer_communications FOR DELETE
  USING (tenant_id IN (
    SELECT a.tenant_id FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid()
  ));

-- Add indexes for performance
CREATE INDEX idx_customer_activities_customer ON public.customer_activities(customer_id);
CREATE INDEX idx_customer_activities_tenant ON public.customer_activities(tenant_id);
CREATE INDEX idx_customer_activities_created_at ON public.customer_activities(created_at DESC);

CREATE INDEX idx_customer_communications_customer ON public.customer_communications(customer_id);
CREATE INDEX idx_customer_communications_tenant ON public.customer_communications(tenant_id);
CREATE INDEX idx_customer_communications_sent_at ON public.customer_communications(sent_at DESC);