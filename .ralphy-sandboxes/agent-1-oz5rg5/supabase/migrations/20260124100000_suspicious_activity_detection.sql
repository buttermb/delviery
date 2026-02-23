-- ============================================================================
-- SUSPICIOUS ACTIVITY DETECTION
-- Tracks known devices per user, detects new device/location logins,
-- sends email notifications, and provides one-click account security
-- ============================================================================

-- Table: user_known_devices
-- Stores trusted devices for each user
CREATE TABLE IF NOT EXISTS user_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text, -- e.g. "Chrome on Windows"
  device_type text, -- desktop, mobile, tablet
  browser text,
  os text,
  ip_address inet,
  geo_country text,
  geo_city text,
  is_trusted boolean DEFAULT false,
  first_seen_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  trust_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, device_fingerprint)
);

-- Table: suspicious_login_alerts
-- Records each suspicious login event and tracks notification/response status
CREATE TABLE IF NOT EXISTS suspicious_login_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  device_id uuid REFERENCES user_known_devices(id) ON DELETE SET NULL,
  device_fingerprint text NOT NULL,
  ip_address inet,
  geo_country text,
  geo_city text,
  user_agent text,
  browser text,
  os text,
  device_type text,
  alert_type text NOT NULL CHECK (alert_type IN ('new_device', 'new_location', 'new_device_and_location')),
  severity text DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  -- Notification tracking
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  -- User response
  user_response text CHECK (user_response IN ('confirmed_me', 'not_me', 'ignored')),
  responded_at timestamptz,
  -- Security action taken
  account_secured boolean DEFAULT false,
  secured_at timestamptz,
  -- Token for one-click secure action
  secure_token text UNIQUE,
  secure_token_expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_user_known_devices_user ON user_known_devices(user_id, last_seen_at DESC);
CREATE INDEX idx_user_known_devices_fingerprint ON user_known_devices(device_fingerprint);
CREATE INDEX idx_user_known_devices_tenant ON user_known_devices(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_suspicious_login_alerts_user ON suspicious_login_alerts(user_id, created_at DESC);
CREATE INDEX idx_suspicious_login_alerts_token ON suspicious_login_alerts(secure_token) WHERE secure_token IS NOT NULL;
CREATE INDEX idx_suspicious_login_alerts_pending ON suspicious_login_alerts(user_id, user_response) WHERE user_response IS NULL;
CREATE INDEX idx_suspicious_login_alerts_tenant ON suspicious_login_alerts(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

-- RLS Policies
ALTER TABLE user_known_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_login_alerts ENABLE ROW LEVEL SECURITY;

-- Users can see their own devices
CREATE POLICY "users_view_own_devices" ON user_known_devices
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own devices (trust/untrust)
CREATE POLICY "users_update_own_devices" ON user_known_devices
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "users_delete_own_devices" ON user_known_devices
FOR DELETE USING (auth.uid() = user_id);

-- Service role can insert devices
CREATE POLICY "service_insert_devices" ON user_known_devices
FOR INSERT WITH CHECK (true);

-- Users can see their own alerts
CREATE POLICY "users_view_own_alerts" ON suspicious_login_alerts
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own alerts (respond)
CREATE POLICY "users_update_own_alerts" ON suspicious_login_alerts
FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert alerts
CREATE POLICY "service_insert_alerts" ON suspicious_login_alerts
FOR INSERT WITH CHECK (true);

-- Tenant admins can view alerts for their tenant users
CREATE POLICY "tenant_admins_view_alerts" ON suspicious_login_alerts
FOR SELECT USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('owner', 'admin')
  )
);

-- Tenant admins can view devices for their tenant users
CREATE POLICY "tenant_admins_view_devices" ON user_known_devices
FOR SELECT USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: check_device_and_detect_suspicious_login
-- Called during login to check if device is known, create alert if not
CREATE OR REPLACE FUNCTION check_device_suspicious_login(
  p_user_id uuid,
  p_device_fingerprint text,
  p_device_type text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_geo_country text DEFAULT NULL,
  p_geo_city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id uuid;
  v_is_new_device boolean := false;
  v_is_new_location boolean := false;
  v_alert_type text;
  v_alert_id uuid;
  v_secure_token text;
  v_tenant_id uuid;
  v_device_name text;
  v_known_device_count integer;
BEGIN
  -- Get tenant_id for the user
  SELECT tu.tenant_id INTO v_tenant_id
  FROM tenant_users tu
  WHERE tu.user_id = p_user_id
  LIMIT 1;

  -- Build device name
  v_device_name := COALESCE(p_browser, 'Unknown') || ' on ' || COALESCE(p_os, 'Unknown');

  -- Check if this device fingerprint is already known
  SELECT id INTO v_device_id
  FROM user_known_devices
  WHERE user_id = p_user_id
    AND device_fingerprint = p_device_fingerprint;

  IF v_device_id IS NULL THEN
    -- New device detected
    v_is_new_device := true;

    -- Insert new device record
    INSERT INTO user_known_devices (
      user_id, tenant_id, device_fingerprint, device_name,
      device_type, browser, os, ip_address,
      geo_country, geo_city, is_trusted
    ) VALUES (
      p_user_id, v_tenant_id, p_device_fingerprint, v_device_name,
      p_device_type, p_browser, p_os, p_ip_address,
      p_geo_country, p_geo_city, false
    )
    RETURNING id INTO v_device_id;
  ELSE
    -- Known device - update last seen and check for new location
    UPDATE user_known_devices
    SET last_seen_at = now(),
        ip_address = COALESCE(p_ip_address, ip_address),
        browser = COALESCE(p_browser, browser),
        os = COALESCE(p_os, os)
    WHERE id = v_device_id;

    -- Check if login is from a new location for this device
    IF p_geo_country IS NOT NULL THEN
      SELECT COUNT(*) INTO v_known_device_count
      FROM user_known_devices
      WHERE user_id = p_user_id
        AND geo_country = p_geo_country
        AND is_trusted = true;

      IF v_known_device_count = 0 THEN
        v_is_new_location := true;
      END IF;
    END IF;
  END IF;

  -- Determine alert type
  IF v_is_new_device AND v_is_new_location THEN
    v_alert_type := 'new_device_and_location';
  ELSIF v_is_new_device THEN
    v_alert_type := 'new_device';
  ELSIF v_is_new_location THEN
    v_alert_type := 'new_location';
  END IF;

  -- If suspicious, create an alert
  IF v_alert_type IS NOT NULL THEN
    -- Check how many known trusted devices user has
    -- If this is the first device, don't alert (first login ever)
    SELECT COUNT(*) INTO v_known_device_count
    FROM user_known_devices
    WHERE user_id = p_user_id
      AND is_trusted = true;

    IF v_known_device_count > 0 THEN
      -- Generate secure token for one-click action
      v_secure_token := encode(gen_random_bytes(32), 'hex');

      INSERT INTO suspicious_login_alerts (
        user_id, tenant_id, device_id, device_fingerprint,
        ip_address, geo_country, geo_city, user_agent,
        browser, os, device_type, alert_type,
        severity, secure_token, secure_token_expires_at
      ) VALUES (
        p_user_id, v_tenant_id, v_device_id, p_device_fingerprint,
        p_ip_address, p_geo_country, p_geo_city, p_user_agent,
        p_browser, p_os, p_device_type, v_alert_type,
        CASE WHEN v_alert_type = 'new_device_and_location' THEN 'critical' ELSE 'warning' END,
        v_secure_token,
        now() + interval '24 hours'
      )
      RETURNING id INTO v_alert_id;

      -- Log in audit_events
      PERFORM log_audit_event(
        p_tenant_id := v_tenant_id,
        p_category := 'auth',
        p_event_type := 'suspicious_login_' || v_alert_type,
        p_severity := CASE WHEN v_alert_type = 'new_device_and_location' THEN 'critical' ELSE 'warning' END,
        p_actor_type := 'tenant_user',
        p_actor_id := p_user_id,
        p_ip_address := p_ip_address,
        p_user_agent := p_user_agent,
        p_details := jsonb_build_object(
          'alert_id', v_alert_id,
          'alert_type', v_alert_type,
          'device_fingerprint', p_device_fingerprint,
          'device_name', v_device_name,
          'geo_country', p_geo_country,
          'geo_city', p_geo_city,
          'browser', p_browser,
          'os', p_os
        )
      );

      RETURN jsonb_build_object(
        'is_suspicious', true,
        'alert_type', v_alert_type,
        'alert_id', v_alert_id,
        'device_id', v_device_id,
        'secure_token', v_secure_token
      );
    ELSE
      -- First device - auto-trust it
      UPDATE user_known_devices
      SET is_trusted = true, trust_confirmed_at = now()
      WHERE id = v_device_id;

      -- Log first device registration
      PERFORM log_audit_event(
        p_tenant_id := v_tenant_id,
        p_category := 'auth',
        p_event_type := 'first_device_registered',
        p_severity := 'info',
        p_actor_type := 'tenant_user',
        p_actor_id := p_user_id,
        p_ip_address := p_ip_address,
        p_details := jsonb_build_object(
          'device_fingerprint', p_device_fingerprint,
          'device_name', v_device_name
        )
      );
    END IF;
  ELSE
    -- Known device + known location - log normal login
    PERFORM log_audit_event(
      p_tenant_id := v_tenant_id,
      p_category := 'auth',
      p_event_type := 'device_login',
      p_severity := 'info',
      p_actor_type := 'tenant_user',
      p_actor_id := p_user_id,
      p_ip_address := p_ip_address,
      p_details := jsonb_build_object(
        'device_id', v_device_id,
        'device_fingerprint', p_device_fingerprint,
        'device_name', v_device_name
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'is_suspicious', false,
    'device_id', v_device_id,
    'is_new_device', v_is_new_device
  );
END;
$$;

-- Function: secure_account_from_alert
-- Called when user clicks "Not me - secure my account" link
CREATE OR REPLACE FUNCTION secure_account_from_alert(
  p_secure_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert suspicious_login_alerts%ROWTYPE;
  v_sessions_revoked integer := 0;
BEGIN
  -- Find the alert by token
  SELECT * INTO v_alert
  FROM suspicious_login_alerts
  WHERE secure_token = p_secure_token
    AND secure_token_expires_at > now()
    AND account_secured = false;

  IF v_alert IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired security token'
    );
  END IF;

  -- Mark the alert as responded
  UPDATE suspicious_login_alerts
  SET user_response = 'not_me',
      responded_at = now(),
      account_secured = true,
      secured_at = now()
  WHERE id = v_alert.id;

  -- Remove the suspicious device from known devices (untrust it)
  UPDATE user_known_devices
  SET is_trusted = false
  WHERE id = v_alert.device_id;

  -- Log the security action in audit_events
  PERFORM log_audit_event(
    p_tenant_id := v_alert.tenant_id,
    p_category := 'auth',
    p_event_type := 'account_secured_from_alert',
    p_severity := 'critical',
    p_actor_type := 'tenant_user',
    p_actor_id := v_alert.user_id,
    p_details := jsonb_build_object(
      'alert_id', v_alert.id,
      'alert_type', v_alert.alert_type,
      'suspicious_device_fingerprint', v_alert.device_fingerprint,
      'suspicious_ip', v_alert.ip_address::text,
      'suspicious_geo', v_alert.geo_country || ', ' || v_alert.geo_city
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_alert.user_id,
    'alert_id', v_alert.id,
    'action_taken', 'account_secured'
  );
END;
$$;

-- Function: confirm_login_was_me
-- Called when user confirms the login was theirs
CREATE OR REPLACE FUNCTION confirm_login_was_me(
  p_alert_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert suspicious_login_alerts%ROWTYPE;
BEGIN
  SELECT * INTO v_alert
  FROM suspicious_login_alerts
  WHERE id = p_alert_id
    AND user_id = p_user_id;

  IF v_alert IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alert not found');
  END IF;

  -- Mark as confirmed
  UPDATE suspicious_login_alerts
  SET user_response = 'confirmed_me',
      responded_at = now()
  WHERE id = v_alert.id;

  -- Trust the device
  UPDATE user_known_devices
  SET is_trusted = true,
      trust_confirmed_at = now()
  WHERE id = v_alert.device_id;

  -- Log confirmation
  PERFORM log_audit_event(
    p_tenant_id := v_alert.tenant_id,
    p_category := 'auth',
    p_event_type := 'login_confirmed_by_user',
    p_severity := 'info',
    p_actor_type := 'tenant_user',
    p_actor_id := p_user_id,
    p_details := jsonb_build_object(
      'alert_id', v_alert.id,
      'device_id', v_alert.device_id
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_device_suspicious_login TO authenticated;
GRANT EXECUTE ON FUNCTION secure_account_from_alert TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_login_was_me TO authenticated;

COMMENT ON TABLE user_known_devices IS 'Tracks known/trusted devices per user for suspicious login detection';
COMMENT ON TABLE suspicious_login_alerts IS 'Records suspicious login events with notification and response tracking';
COMMENT ON FUNCTION check_device_suspicious_login IS 'Checks if a login is from a new device/location and creates alerts';
COMMENT ON FUNCTION secure_account_from_alert IS 'One-click account security action from email notification';
COMMENT ON FUNCTION confirm_login_was_me IS 'User confirms a flagged login was legitimate';
