
-- Security enhancements for disposable menus

-- Table to log security events (breaches, failed checks, etc.)
CREATE TABLE IF NOT EXISTS menu_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID REFERENCES disposable_menus(id),
  event_type TEXT NOT NULL, -- 'access_code', 'geofence', 'velocity', 'device_lock', etc.
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  event_data JSONB DEFAULT '{}'::jsonb, -- Store IP, location, device fingerprint, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Index for querying security events by menu
CREATE INDEX IF NOT EXISTS idx_security_events_menu ON menu_security_events(menu_id);
-- Index for querying by severity (for alerts)
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON menu_security_events(severity);

-- Add security_settings column to disposable_menus if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposable_menus' AND column_name = 'security_settings') THEN
        ALTER TABLE disposable_menus ADD COLUMN security_settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add view_limit_per_customer column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposable_menus' AND column_name = 'view_limit_per_customer') THEN
        ALTER TABLE disposable_menus ADD COLUMN view_limit_per_customer INTEGER;
    END IF;
END $$;

-- Add auto_burn_hours column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposable_menus' AND column_name = 'auto_burn_hours') THEN
        ALTER TABLE disposable_menus ADD COLUMN auto_burn_hours INTEGER;
    END IF;
END $$;
