-- ============================================================================
-- ANTI-ABUSE PROTECTION SYSTEM
-- ============================================================================
-- Prevents re-signup abuse with multiple layers of protection:
-- 1. Device fingerprinting
-- 2. Phone verification
-- 3. IP address tracking
-- 4. Email domain restrictions
-- ============================================================================

-- ============================================================================
-- SIGNUP FINGERPRINTS TABLE
-- ============================================================================
-- Tracks unique device/browser fingerprints to prevent re-signups

CREATE TABLE IF NOT EXISTS public.signup_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash TEXT NOT NULL,
  ip_address TEXT,
  ip_hash TEXT,
  phone_hash TEXT,
  email_domain TEXT,
  user_agent_hash TEXT,
  canvas_hash TEXT,
  webgl_hash TEXT,
  audio_hash TEXT,
  fonts_hash TEXT,
  timezone TEXT,
  language TEXT,
  screen_resolution TEXT,
  color_depth INTEGER,
  touch_support BOOLEAN,
  platform TEXT,
  signup_count INTEGER DEFAULT 1,
  last_signup_at TIMESTAMPTZ DEFAULT now(),
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  is_suspicious BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_fingerprints_hash ON public.signup_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_signup_fingerprints_ip_hash ON public.signup_fingerprints(ip_hash);
CREATE INDEX IF NOT EXISTS idx_signup_fingerprints_phone_hash ON public.signup_fingerprints(phone_hash);
CREATE INDEX IF NOT EXISTS idx_signup_fingerprints_email_domain ON public.signup_fingerprints(email_domain);
CREATE INDEX IF NOT EXISTS idx_signup_fingerprints_suspicious ON public.signup_fingerprints(is_suspicious) WHERE is_suspicious = true;

-- ============================================================================
-- BLOCKED SIGNUPS TABLE
-- ============================================================================
-- Tracks blocked identifiers (IP, phone, fingerprint, email domain)

CREATE TABLE IF NOT EXISTS public.blocked_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'phone', 'fingerprint', 'email_domain', 'device_id')),
  identifier_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocked_by UUID, -- admin user ID if manual block
  blocked_until TIMESTAMPTZ, -- null = permanent
  block_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_blocked_signups_type_value ON public.blocked_signups(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_blocked_signups_until ON public.blocked_signups(blocked_until) WHERE blocked_until IS NOT NULL;

-- ============================================================================
-- PHONE VERIFICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_hash ON public.phone_verifications(phone_hash);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_tenant ON public.phone_verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires ON public.phone_verifications(expires_at) WHERE verified = false;

-- ============================================================================
-- FREE TIER USAGE TRACKING TABLE
-- ============================================================================
-- Tracks daily/monthly limits for free tier users

CREATE TABLE IF NOT EXISTS public.tenant_free_tier_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Daily counts (reset at midnight)
  menus_created_today INTEGER DEFAULT 0,
  orders_created_today INTEGER DEFAULT 0,
  sms_sent_today INTEGER DEFAULT 0,
  emails_sent_today INTEGER DEFAULT 0,
  pos_sales_today INTEGER DEFAULT 0,
  bulk_operations_today INTEGER DEFAULT 0,
  
  -- Monthly counts (reset on billing cycle)
  exports_this_month INTEGER DEFAULT 0,
  invoices_this_month INTEGER DEFAULT 0,
  custom_reports_this_month INTEGER DEFAULT 0,
  ai_features_this_month INTEGER DEFAULT 0,
  
  -- Resource counts (all time)
  total_products INTEGER DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  total_team_members INTEGER DEFAULT 1,
  total_locations INTEGER DEFAULT 1,
  
  -- Reset timestamps
  last_daily_reset TIMESTAMPTZ DEFAULT now(),
  last_monthly_reset TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_free_tier_usage_tenant ON public.tenant_free_tier_usage(tenant_id);

-- ============================================================================
-- ADD COLUMNS TO TENANTS TABLE
-- ============================================================================

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone_hash TEXT,
ADD COLUMN IF NOT EXISTS signup_fingerprint_id UUID REFERENCES public.signup_fingerprints(id),
ADD COLUMN IF NOT EXISTS signup_ip_address TEXT,
ADD COLUMN IF NOT EXISTS signup_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS abuse_flags JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_tenants_phone_hash ON public.tenants(phone_hash);
CREATE INDEX IF NOT EXISTS idx_tenants_suspicious ON public.tenants(is_suspicious) WHERE is_suspicious = true;

-- ============================================================================
-- CHECK SIGNUP ELIGIBILITY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_signup_eligibility(
  p_fingerprint_hash TEXT,
  p_ip_address TEXT,
  p_email TEXT,
  p_phone_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  eligible BOOLEAN,
  reason TEXT,
  risk_score INTEGER,
  existing_signups INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_hash TEXT;
  v_email_domain TEXT;
  v_risk_score INTEGER := 0;
  v_existing_signups INTEGER := 0;
  v_blocked_record RECORD;
  v_fingerprint_record RECORD;
  v_reason TEXT;
BEGIN
  -- Hash the IP address
  v_ip_hash := encode(sha256(p_ip_address::bytea), 'hex');
  
  -- Extract email domain
  v_email_domain := split_part(p_email, '@', 2);
  
  -- Check if any identifier is blocked
  SELECT * INTO v_blocked_record
  FROM public.blocked_signups
  WHERE (
    (identifier_type = 'ip' AND identifier_value = v_ip_hash) OR
    (identifier_type = 'fingerprint' AND identifier_value = p_fingerprint_hash) OR
    (identifier_type = 'email_domain' AND identifier_value = v_email_domain) OR
    (identifier_type = 'phone' AND p_phone_hash IS NOT NULL AND identifier_value = p_phone_hash)
  )
  AND (blocked_until IS NULL OR blocked_until > now())
  LIMIT 1;
  
  IF v_blocked_record IS NOT NULL THEN
    RETURN QUERY SELECT false, v_blocked_record.reason, 100, 0;
    RETURN;
  END IF;
  
  -- Check for existing fingerprint
  SELECT * INTO v_fingerprint_record
  FROM public.signup_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash
  OR ip_hash = v_ip_hash
  OR (p_phone_hash IS NOT NULL AND phone_hash = p_phone_hash)
  ORDER BY signup_count DESC
  LIMIT 1;
  
  IF v_fingerprint_record IS NOT NULL THEN
    v_existing_signups := v_fingerprint_record.signup_count;
    
    -- Add risk based on previous signups
    IF v_existing_signups >= 3 THEN
      v_risk_score := v_risk_score + 50;
      v_reason := 'Multiple previous signups detected';
    ELSIF v_existing_signups >= 2 THEN
      v_risk_score := v_risk_score + 30;
    ELSIF v_existing_signups >= 1 THEN
      v_risk_score := v_risk_score + 15;
    END IF;
    
    -- Check if same fingerprint in last 24 hours
    IF v_fingerprint_record.last_signup_at > now() - interval '24 hours' THEN
      v_risk_score := v_risk_score + 25;
      IF v_reason IS NULL THEN
        v_reason := 'Recent signup from same device';
      END IF;
    END IF;
    
    -- Check if already suspicious
    IF v_fingerprint_record.is_suspicious THEN
      v_risk_score := v_risk_score + 30;
    END IF;
  END IF;
  
  -- Check for disposable email domains
  IF v_email_domain IN (
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'getnada.com',
    'maildrop.cc', 'yopmail.com', 'tempail.com', 'dispostable.com'
  ) THEN
    v_risk_score := v_risk_score + 40;
    IF v_reason IS NULL THEN
      v_reason := 'Disposable email domain detected';
    END IF;
  END IF;
  
  -- Block if risk score is too high
  IF v_risk_score >= 75 THEN
    RETURN QUERY SELECT false, COALESCE(v_reason, 'High risk signup detected'), v_risk_score, v_existing_signups;
    RETURN;
  END IF;
  
  -- Require phone verification for medium risk
  IF v_risk_score >= 40 AND p_phone_hash IS NULL THEN
    RETURN QUERY SELECT false, 'Phone verification required', v_risk_score, v_existing_signups;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT, v_risk_score, v_existing_signups;
END;
$$;

-- ============================================================================
-- RECORD SIGNUP FINGERPRINT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_signup_fingerprint(
  p_fingerprint_hash TEXT,
  p_ip_address TEXT,
  p_phone_hash TEXT DEFAULT NULL,
  p_email_domain TEXT DEFAULT NULL,
  p_user_agent_hash TEXT DEFAULT NULL,
  p_canvas_hash TEXT DEFAULT NULL,
  p_webgl_hash TEXT DEFAULT NULL,
  p_audio_hash TEXT DEFAULT NULL,
  p_fonts_hash TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL,
  p_screen_resolution TEXT DEFAULT NULL,
  p_color_depth INTEGER DEFAULT NULL,
  p_touch_support BOOLEAN DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_hash TEXT;
  v_fingerprint_id UUID;
BEGIN
  v_ip_hash := encode(sha256(p_ip_address::bytea), 'hex');
  
  -- Try to find existing fingerprint
  SELECT id INTO v_fingerprint_id
  FROM public.signup_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash
  LIMIT 1;
  
  IF v_fingerprint_id IS NOT NULL THEN
    -- Update existing record
    UPDATE public.signup_fingerprints
    SET 
      signup_count = signup_count + 1,
      last_signup_at = now(),
      ip_address = p_ip_address,
      ip_hash = v_ip_hash,
      phone_hash = COALESCE(p_phone_hash, phone_hash),
      email_domain = COALESCE(p_email_domain, email_domain),
      is_suspicious = CASE WHEN signup_count >= 2 THEN true ELSE is_suspicious END,
      risk_score = CASE WHEN signup_count >= 3 THEN 75 WHEN signup_count >= 2 THEN 50 ELSE risk_score END
    WHERE id = v_fingerprint_id;
    
    RETURN v_fingerprint_id;
  END IF;
  
  -- Create new record
  INSERT INTO public.signup_fingerprints (
    fingerprint_hash,
    ip_address,
    ip_hash,
    phone_hash,
    email_domain,
    user_agent_hash,
    canvas_hash,
    webgl_hash,
    audio_hash,
    fonts_hash,
    timezone,
    language,
    screen_resolution,
    color_depth,
    touch_support,
    platform
  ) VALUES (
    p_fingerprint_hash,
    p_ip_address,
    v_ip_hash,
    p_phone_hash,
    p_email_domain,
    p_user_agent_hash,
    p_canvas_hash,
    p_webgl_hash,
    p_audio_hash,
    p_fonts_hash,
    p_timezone,
    p_language,
    p_screen_resolution,
    p_color_depth,
    p_touch_support,
    p_platform
  )
  RETURNING id INTO v_fingerprint_id;
  
  RETURN v_fingerprint_id;
END;
$$;

-- ============================================================================
-- INCREMENT FREE TIER USAGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_free_tier_usage(
  p_tenant_id UUID,
  p_action_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create record if doesn't exist
  INSERT INTO public.tenant_free_tier_usage (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Check if daily reset needed
  UPDATE public.tenant_free_tier_usage
  SET 
    menus_created_today = 0,
    orders_created_today = 0,
    sms_sent_today = 0,
    emails_sent_today = 0,
    pos_sales_today = 0,
    bulk_operations_today = 0,
    last_daily_reset = now()
  WHERE tenant_id = p_tenant_id
  AND last_daily_reset < date_trunc('day', now());
  
  -- Increment the appropriate counter
  CASE p_action_type
    WHEN 'menu_create' THEN
      UPDATE public.tenant_free_tier_usage SET menus_created_today = menus_created_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'order_create' THEN
      UPDATE public.tenant_free_tier_usage SET orders_created_today = orders_created_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'sms_send' THEN
      UPDATE public.tenant_free_tier_usage SET sms_sent_today = sms_sent_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'email_send' THEN
      UPDATE public.tenant_free_tier_usage SET emails_sent_today = emails_sent_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'pos_sale' THEN
      UPDATE public.tenant_free_tier_usage SET pos_sales_today = pos_sales_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'bulk_operation' THEN
      UPDATE public.tenant_free_tier_usage SET bulk_operations_today = bulk_operations_today + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'export' THEN
      UPDATE public.tenant_free_tier_usage SET exports_this_month = exports_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'invoice_create' THEN
      UPDATE public.tenant_free_tier_usage SET invoices_this_month = invoices_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'custom_report' THEN
      UPDATE public.tenant_free_tier_usage SET custom_reports_this_month = custom_reports_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'ai_feature' THEN
      UPDATE public.tenant_free_tier_usage SET ai_features_this_month = ai_features_this_month + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'product_add' THEN
      UPDATE public.tenant_free_tier_usage SET total_products = total_products + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'customer_add' THEN
      UPDATE public.tenant_free_tier_usage SET total_customers = total_customers + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'team_member_add' THEN
      UPDATE public.tenant_free_tier_usage SET total_team_members = total_team_members + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    WHEN 'location_add' THEN
      UPDATE public.tenant_free_tier_usage SET total_locations = total_locations + 1, updated_at = now() WHERE tenant_id = p_tenant_id;
    ELSE
      NULL; -- Unknown action type, ignore
  END CASE;
END;
$$;

-- ============================================================================
-- RESET FREE TIER MONTHLY USAGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_free_tier_monthly_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.tenant_free_tier_usage
  SET 
    exports_this_month = 0,
    invoices_this_month = 0,
    custom_reports_this_month = 0,
    ai_features_this_month = 0,
    last_monthly_reset = now(),
    updated_at = now()
  WHERE last_monthly_reset < date_trunc('month', now());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.signup_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_free_tier_usage ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to signup_fingerprints" ON public.signup_fingerprints
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to blocked_signups" ON public.blocked_signups
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to phone_verifications" ON public.phone_verifications
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Tenants can view their own usage
CREATE POLICY "Tenants can view own free tier usage" ON public.tenant_free_tier_usage
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.profiles WHERE tenant_id = tenant_free_tier_usage.tenant_id
    )
  );

CREATE POLICY "Service role full access to tenant_free_tier_usage" ON public.tenant_free_tier_usage
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.signup_fingerprints IS 'Tracks device fingerprints to prevent signup abuse';
COMMENT ON TABLE public.blocked_signups IS 'Blocked identifiers for signup prevention';
COMMENT ON TABLE public.phone_verifications IS 'Phone verification codes and status';
COMMENT ON TABLE public.tenant_free_tier_usage IS 'Tracks daily/monthly limits for free tier users';
COMMENT ON FUNCTION public.check_signup_eligibility IS 'Checks if a signup should be allowed based on fingerprint, IP, email, and phone';
COMMENT ON FUNCTION public.record_signup_fingerprint IS 'Records signup fingerprint for abuse prevention';
COMMENT ON FUNCTION public.increment_free_tier_usage IS 'Increments usage counters for free tier limits';







