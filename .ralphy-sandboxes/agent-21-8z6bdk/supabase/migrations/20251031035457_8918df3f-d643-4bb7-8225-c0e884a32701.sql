-- Phase 6: Database Enhancements for Disposable Menus

-- 1. Enhance disposable_menus table with new security and appearance columns
ALTER TABLE disposable_menus 
ADD COLUMN IF NOT EXISTS screenshot_protection_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS screenshot_watermark_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS device_locking_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS view_limit_per_customer integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS view_limit_period text DEFAULT 'week',
ADD COLUMN IF NOT EXISTS auto_burn_hours integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS access_code_rotation_days integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS appearance_style text DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS custom_message text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{"email": true, "sms": false, "security_alerts": true}'::jsonb,
ADD COLUMN IF NOT EXISTS access_type text DEFAULT 'invite_only',
ADD COLUMN IF NOT EXISTS show_product_images boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_availability boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_contact_info boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_minimum_order boolean DEFAULT true;

-- 2. Create table for tracking screenshot attempts
CREATE TABLE IF NOT EXISTS menu_screenshot_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE CASCADE,
  customer_id uuid,
  customer_name text,
  attempted_at timestamptz DEFAULT now(),
  device_fingerprint text,
  ip_address text,
  user_agent text,
  action_taken text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create table for device locking
CREATE TABLE IF NOT EXISTS menu_device_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE CASCADE,
  customer_id uuid,
  whitelist_entry_id uuid,
  device_fingerprint text NOT NULL,
  device_info jsonb,
  first_access_at timestamptz DEFAULT now(),
  last_access_at timestamptz DEFAULT now(),
  access_count integer DEFAULT 1,
  is_locked boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(menu_id, customer_id, device_fingerprint)
);

-- 4. Create table for view limit tracking
CREATE TABLE IF NOT EXISTS menu_view_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE CASCADE,
  customer_id uuid,
  whitelist_entry_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  view_count integer DEFAULT 0,
  last_view_at timestamptz,
  limit_exceeded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(menu_id, customer_id, period_start)
);

-- 5. Create table for honeypot links
CREATE TABLE IF NOT EXISTS menu_honeypots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE CASCADE,
  honeypot_token text UNIQUE NOT NULL,
  suspected_leaker_id uuid,
  suspected_leaker_name text,
  description text,
  created_at timestamptz DEFAULT now(),
  first_accessed_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0,
  is_active boolean DEFAULT true
);

-- 6. Create table for access code rotation history
CREATE TABLE IF NOT EXISTS menu_access_code_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE CASCADE,
  old_code_hash text,
  new_code_hash text NOT NULL,
  rotated_at timestamptz DEFAULT now(),
  rotated_by uuid,
  reason text
);

-- 7. Create table for panic mode events
CREATE TABLE IF NOT EXISTS menu_panic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid,
  triggered_at timestamptz DEFAULT now(),
  affected_menus jsonb,
  reason text,
  actions_taken jsonb,
  notifications_sent jsonb
);

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_screenshot_attempts_menu_id ON menu_screenshot_attempts(menu_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_attempts_customer_id ON menu_screenshot_attempts(customer_id);
CREATE INDEX IF NOT EXISTS idx_device_locks_menu_id ON menu_device_locks(menu_id);
CREATE INDEX IF NOT EXISTS idx_device_locks_customer_id ON menu_device_locks(customer_id);
CREATE INDEX IF NOT EXISTS idx_view_tracking_menu_customer ON menu_view_tracking(menu_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_honeypots_menu_id ON menu_honeypots(menu_id);
CREATE INDEX IF NOT EXISTS idx_honeypots_token ON menu_honeypots(honeypot_token);

-- 9. Add RLS policies for new tables
ALTER TABLE menu_screenshot_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_device_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_view_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_honeypots ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_access_code_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_panic_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all screenshot attempts
CREATE POLICY "Admins can view screenshot attempts" ON menu_screenshot_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can insert screenshot attempts
CREATE POLICY "System can log screenshot attempts" ON menu_screenshot_attempts
  FOR INSERT WITH CHECK (true);

-- Admins can manage device locks
CREATE POLICY "Admins can manage device locks" ON menu_device_locks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can manage device locks
CREATE POLICY "System can manage device locks" ON menu_device_locks
  FOR ALL USING (true);

-- Admins can view view tracking
CREATE POLICY "Admins can view tracking" ON menu_view_tracking
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can update view tracking
CREATE POLICY "System can update view tracking" ON menu_view_tracking
  FOR ALL USING (true);

-- Admins can manage honeypots
CREATE POLICY "Admins can manage honeypots" ON menu_honeypots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins can view code rotation history
CREATE POLICY "Admins can view code history" ON menu_access_code_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can log code rotations
CREATE POLICY "System can log code rotations" ON menu_access_code_history
  FOR INSERT WITH CHECK (true);

-- Admins can view panic events
CREATE POLICY "Admins can view panic events" ON menu_panic_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- System can log panic events
CREATE POLICY "System can log panic events" ON menu_panic_events
  FOR INSERT WITH CHECK (true);

-- 10. Create function to automatically update view tracking
CREATE OR REPLACE FUNCTION update_menu_view_tracking()
RETURNS TRIGGER AS $$
DECLARE
  period_start_date date;
  period_end_date date;
BEGIN
  -- Calculate period based on menu settings
  IF NEW.action = 'viewed' THEN
    period_start_date := date_trunc('week', NEW.accessed_at)::date;
    period_end_date := (period_start_date + interval '7 days')::date;
    
    -- Insert or update view tracking
    INSERT INTO menu_view_tracking (
      menu_id,
      customer_id,
      whitelist_entry_id,
      period_start,
      period_end,
      view_count,
      last_view_at
    ) VALUES (
      NEW.menu_id,
      NEW.customer_id,
      NEW.whitelist_entry_id,
      period_start_date,
      period_end_date,
      1,
      NEW.accessed_at
    )
    ON CONFLICT (menu_id, customer_id, period_start)
    DO UPDATE SET
      view_count = menu_view_tracking.view_count + 1,
      last_view_at = NEW.accessed_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for view tracking
DROP TRIGGER IF EXISTS trigger_update_view_tracking ON menu_access_logs;
CREATE TRIGGER trigger_update_view_tracking
  AFTER INSERT ON menu_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_view_tracking();