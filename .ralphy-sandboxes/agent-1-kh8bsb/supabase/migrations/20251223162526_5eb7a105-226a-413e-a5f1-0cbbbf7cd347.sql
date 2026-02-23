-- =====================================================
-- CRITICAL FIX #16: Email Delivery Retry System
-- =====================================================

-- Email logs table for tracking all sent emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Failed emails table for retry queue
CREATE TABLE IF NOT EXISTS public.failed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  email_data JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for email retry system
CREATE INDEX IF NOT EXISTS idx_failed_emails_next_retry ON public.failed_emails(next_retry, retry_count);
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON public.email_logs(tenant_id, created_at);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_logs
CREATE POLICY "Service role can manage email_logs" ON public.email_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Tenant admins can view their email logs" ON public.email_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = 'active')
  );

-- RLS policies for failed_emails
CREATE POLICY "Service role can manage failed_emails" ON public.failed_emails
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- CRITICAL FIX #20: Cancellation Intent Tracking
-- =====================================================

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_requested_by TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_completed_at TIMESTAMPTZ;

-- =====================================================
-- CRITICAL FIX #18: Rate Limiting Enforcement
-- =====================================================

CREATE TABLE IF NOT EXISTS public.action_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID,
  action_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_action_log_rate_limit ON public.action_log(tenant_id, action_type, created_at);
CREATE INDEX IF NOT EXISTS idx_action_log_created_at ON public.action_log(created_at);

-- Enable RLS
ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage action_log" ON public.action_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can insert their own actions" ON public.action_log
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Tenant members can view action logs" ON public.action_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND status = 'active')
  );

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_tenant_id UUID,
  p_action_type TEXT,
  p_limit INTEGER,
  p_window_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_remaining INTEGER;
BEGIN
  v_window_start := now() - (p_window_hours || ' hours')::interval;
  
  SELECT COUNT(*) INTO v_count
  FROM public.action_log
  WHERE tenant_id = p_tenant_id
    AND action_type = p_action_type
    AND created_at >= v_window_start;
  
  v_remaining := GREATEST(0, p_limit - v_count);
  
  RETURN jsonb_build_object(
    'allowed', v_count < p_limit,
    'used', v_count,
    'limit', p_limit,
    'remaining', v_remaining,
    'reset_at', (v_window_start + (p_window_hours || ' hours')::interval)::TEXT
  );
END;
$$;

-- Log action and check limit atomically
CREATE OR REPLACE FUNCTION public.log_action_with_limit(
  p_tenant_id UUID,
  p_user_id UUID,
  p_action_type TEXT,
  p_limit INTEGER,
  p_window_hours INTEGER DEFAULT 24,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit_check JSONB;
BEGIN
  v_limit_check := public.check_rate_limit(p_tenant_id, p_action_type, p_limit, p_window_hours);
  
  IF NOT (v_limit_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'rate_limit_exceeded',
      'limit', v_limit_check
    );
  END IF;
  
  INSERT INTO public.action_log (tenant_id, user_id, action_type, metadata)
  VALUES (p_tenant_id, p_user_id, p_action_type, p_metadata);
  
  RETURN jsonb_build_object(
    'success', true,
    'limit', jsonb_build_object(
      'used', (v_limit_check->>'used')::INTEGER + 1,
      'limit', p_limit,
      'remaining', GREATEST(0, (v_limit_check->>'remaining')::INTEGER - 1)
    )
  );
END;
$$;