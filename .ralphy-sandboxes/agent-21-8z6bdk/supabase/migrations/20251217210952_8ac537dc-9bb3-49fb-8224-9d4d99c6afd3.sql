-- Create user_backup_codes table for 2FA backup codes
CREATE TABLE IF NOT EXISTS public.user_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON public.user_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_tenant ON public.user_backup_codes(tenant_id);

-- RLS for user_backup_codes
ALTER TABLE public.user_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backup codes"
  ON public.user_backup_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backup codes"
  ON public.user_backup_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backup codes"
  ON public.user_backup_codes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own backup codes"
  ON public.user_backup_codes FOR DELETE
  USING (auth.uid() = user_id);

-- Create notification_delivery_log table
CREATE TABLE IF NOT EXISTS public.notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'email', 'sms', 'push'
  recipient TEXT NOT NULL, -- email address or phone number
  subject TEXT,
  message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON public.notification_delivery_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON public.notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON public.notification_delivery_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_retry ON public.notification_delivery_log(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;

-- RLS for notification_delivery_log
ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view notification logs"
  ON public.notification_delivery_log FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can insert notification logs"
  ON public.notification_delivery_log FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

CREATE POLICY "Tenant members can update notification logs"
  ON public.notification_delivery_log FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Function to get backup codes status
CREATE OR REPLACE FUNCTION get_backup_codes_status(p_user_id UUID)
RETURNS TABLE (
  total_codes INTEGER,
  unused_codes INTEGER,
  used_codes INTEGER,
  needs_regeneration BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_codes,
    COUNT(*) FILTER (WHERE used_at IS NULL)::INTEGER as unused_codes,
    COUNT(*) FILTER (WHERE used_at IS NOT NULL)::INTEGER as used_codes,
    (COUNT(*) FILTER (WHERE used_at IS NULL) < 3) as needs_regeneration
  FROM public.user_backup_codes
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_backup_codes_status TO authenticated;

-- Function to regenerate backup codes
CREATE OR REPLACE FUNCTION regenerate_backup_codes(p_user_id UUID, p_code_hashes TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete old codes
  DELETE FROM public.user_backup_codes WHERE user_id = p_user_id;
  
  -- Insert new codes
  INSERT INTO public.user_backup_codes (user_id, code_hash)
  SELECT p_user_id, unnest(p_code_hashes);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION regenerate_backup_codes TO authenticated;

-- Function to log notification with retry support
CREATE OR REPLACE FUNCTION log_notification(
  p_tenant_id UUID,
  p_notification_type TEXT,
  p_recipient TEXT,
  p_subject TEXT DEFAULT NULL,
  p_message_preview TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.notification_delivery_log (
    tenant_id, notification_type, recipient, subject, message_preview, status, metadata
  ) VALUES (
    p_tenant_id, p_notification_type, p_recipient, p_subject, p_message_preview, p_status, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_notification TO authenticated;

-- Function to update notification status with retry logic
CREATE OR REPLACE FUNCTION update_notification_status(
  p_log_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_retry INTEGER;
  v_max_retries INTEGER;
BEGIN
  SELECT retry_count, max_retries INTO v_current_retry, v_max_retries
  FROM public.notification_delivery_log
  WHERE id = p_log_id;
  
  IF p_status = 'failed' AND v_current_retry < v_max_retries THEN
    -- Schedule retry with exponential backoff
    UPDATE public.notification_delivery_log
    SET 
      status = 'pending',
      retry_count = retry_count + 1,
      next_retry_at = NOW() + (POWER(2, retry_count + 1) || ' minutes')::INTERVAL,
      error_message = p_error_message,
      updated_at = NOW()
    WHERE id = p_log_id;
  ELSE
    UPDATE public.notification_delivery_log
    SET 
      status = p_status,
      error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE error_message END,
      sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
      failed_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE failed_at END,
      updated_at = NOW()
    WHERE id = p_log_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION update_notification_status TO authenticated;