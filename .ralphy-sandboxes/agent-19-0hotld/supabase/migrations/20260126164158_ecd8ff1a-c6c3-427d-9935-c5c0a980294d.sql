-- Fix check_device_suspicious_login function to use correct column name (ip_address instead of last_ip_address)
-- Also add user_agent column to user_known_devices if missing

-- First, add missing columns if they don't exist
ALTER TABLE public.user_known_devices 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Drop and recreate the function with correct column references
CREATE OR REPLACE FUNCTION public.check_device_suspicious_login(
  p_user_id uuid,
  p_device_fingerprint text,
  p_device_type text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_geo_country text DEFAULT NULL,
  p_geo_city text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_device_id UUID;
  v_is_new_device BOOLEAN := FALSE;
  v_is_suspicious BOOLEAN := FALSE;
  v_alert_type TEXT := NULL;
  v_alert_id UUID := NULL;
  v_secure_token TEXT;
  v_last_ip TEXT;
  v_last_country TEXT;
BEGIN
  -- Check if device exists (use ip_address, not last_ip_address)
  SELECT id, ip_address, geo_country
  INTO v_device_id, v_last_ip, v_last_country
  FROM user_known_devices
  WHERE user_id = p_user_id
    AND device_fingerprint = p_device_fingerprint
  LIMIT 1;

  IF v_device_id IS NOT NULL THEN
    -- Known device - update last seen (use ip_address, not last_ip_address)
    UPDATE user_known_devices
    SET 
      last_seen_at = now(),
      ip_address = COALESCE(p_ip_address, ip_address),
      geo_country = COALESCE(p_geo_country, geo_country),
      geo_city = COALESCE(p_geo_city, geo_city),
      user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = v_device_id;

    -- Check for location change
    IF v_last_country IS NOT NULL 
       AND p_geo_country IS NOT NULL 
       AND v_last_country != p_geo_country THEN
      v_is_suspicious := TRUE;
      v_alert_type := 'new_location';
    END IF;
  ELSE
    -- New device - insert it (use ip_address, not last_ip_address)
    v_is_new_device := TRUE;
    v_secure_token := encode(extensions.gen_random_bytes(32), 'hex');

    INSERT INTO user_known_devices (
      user_id,
      device_fingerprint,
      device_type,
      browser,
      os,
      ip_address,
      geo_country,
      geo_city,
      user_agent,
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
      p_user_agent,
      now(),
      now()
    )
    RETURNING id INTO v_device_id;

    -- New device is suspicious
    v_is_suspicious := TRUE;
    
    -- Check if also new location
    SELECT geo_country INTO v_last_country
    FROM user_known_devices
    WHERE user_id = p_user_id
      AND id != v_device_id
      AND geo_country IS NOT NULL
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_last_country IS NOT NULL 
       AND p_geo_country IS NOT NULL 
       AND v_last_country != p_geo_country THEN
      v_alert_type := 'new_device_and_location';
    ELSE
      v_alert_type := 'new_device';
    END IF;
  END IF;

  -- Create alert if suspicious
  IF v_is_suspicious THEN
    v_secure_token := COALESCE(v_secure_token, encode(extensions.gen_random_bytes(32), 'hex'));
    
    INSERT INTO suspicious_login_alerts (
      user_id,
      device_fingerprint,
      ip_address,
      geo_country,
      geo_city,
      alert_type,
      secure_token,
      created_at,
      status
    ) VALUES (
      p_user_id,
      p_device_fingerprint,
      p_ip_address,
      p_geo_country,
      p_geo_city,
      v_alert_type,
      v_secure_token,
      now(),
      'pending'
    )
    RETURNING id INTO v_alert_id;
  END IF;

  RETURN json_build_object(
    'device_id', v_device_id,
    'is_new_device', v_is_new_device,
    'is_suspicious', v_is_suspicious,
    'alert_type', v_alert_type,
    'alert_id', v_alert_id,
    'secure_token', v_secure_token
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_device_suspicious_login TO authenticated;