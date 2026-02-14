-- Create user_known_devices table first
CREATE TABLE IF NOT EXISTS public.user_known_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  geo_country TEXT,
  geo_city TEXT,
  is_trusted BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trust_confirmed_at TIMESTAMPTZ,
  UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_known_devices
CREATE POLICY "Users can view their own devices" 
ON public.user_known_devices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own devices" 
ON public.user_known_devices 
FOR ALL 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_known_devices_user_id ON public.user_known_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_known_devices_fingerprint ON public.user_known_devices(device_fingerprint);

-- Now recreate the check_device_suspicious_login function
DROP FUNCTION IF EXISTS public.check_device_suspicious_login;

CREATE OR REPLACE FUNCTION public.check_device_suspicious_login(
  p_user_id UUID,
  p_device_fingerprint TEXT,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_geo_country TEXT DEFAULT NULL,
  p_geo_city TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id UUID;
  v_is_trusted BOOLEAN := FALSE;
  v_known_country TEXT;
  v_is_new_device BOOLEAN := FALSE;
  v_is_new_location BOOLEAN := FALSE;
  v_is_suspicious BOOLEAN := FALSE;
  v_alert_type TEXT;
  v_alert_id UUID;
  v_secure_token TEXT;
  v_severity TEXT;
BEGIN
  -- Check if device already exists for this user
  SELECT id, is_trusted, geo_country
  INTO v_device_id, v_is_trusted, v_known_country
  FROM user_known_devices
  WHERE user_id = p_user_id AND device_fingerprint = p_device_fingerprint;

  IF v_device_id IS NOT NULL THEN
    -- Device exists - update last seen
    UPDATE user_known_devices
    SET 
      last_seen_at = NOW(),
      ip_address = COALESCE(p_ip_address, ip_address),
      geo_country = COALESCE(p_geo_country, geo_country),
      geo_city = COALESCE(p_geo_city, geo_city)
    WHERE id = v_device_id;

    -- Check if location changed significantly (different country)
    IF v_known_country IS NOT NULL AND p_geo_country IS NOT NULL AND v_known_country != p_geo_country THEN
      v_is_new_location := TRUE;
    END IF;
  ELSE
    -- New device - insert it
    v_is_new_device := TRUE;
    v_secure_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO user_known_devices (
      user_id,
      device_fingerprint,
      device_type,
      browser,
      os,
      ip_address,
      geo_country,
      geo_city,
      is_trusted,
      first_seen_at,
      last_seen_at
    ) VALUES (
      p_user_id,
      p_device_fingerprint,
      p_device_type,
      p_browser,
      p_os,
      p_ip_address,
      p_geo_country,
      p_geo_city,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_device_id;
  END IF;

  -- Determine if suspicious and alert type
  IF v_is_new_device AND v_is_new_location THEN
    v_is_suspicious := TRUE;
    v_alert_type := 'new_device_and_location';
    v_severity := 'critical';
  ELSIF v_is_new_device THEN
    v_is_suspicious := TRUE;
    v_alert_type := 'new_device';
    v_severity := 'high';
  ELSIF v_is_new_location THEN
    v_is_suspicious := TRUE;
    v_alert_type := 'new_location';
    v_severity := 'medium';
  END IF;

  -- Create alert if suspicious
  IF v_is_suspicious THEN
    v_secure_token := COALESCE(v_secure_token, encode(gen_random_bytes(32), 'hex'));
    
    INSERT INTO suspicious_login_alerts (
      user_id,
      device_fingerprint,
      ip_address,
      geo_country,
      geo_city,
      browser,
      os,
      device_type,
      alert_type,
      severity,
      secure_token,
      email_sent,
      created_at
    ) VALUES (
      p_user_id,
      p_device_fingerprint,
      p_ip_address,
      p_geo_country,
      p_geo_city,
      p_browser,
      p_os,
      p_device_type,
      v_alert_type,
      v_severity,
      v_secure_token,
      FALSE,
      NOW()
    )
    RETURNING id INTO v_alert_id;
  END IF;

  RETURN jsonb_build_object(
    'is_suspicious', v_is_suspicious,
    'is_new_device', v_is_new_device,
    'is_new_location', v_is_new_location,
    'device_id', v_device_id,
    'alert_type', v_alert_type,
    'alert_id', v_alert_id,
    'secure_token', v_secure_token
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_device_suspicious_login TO authenticated, service_role;