
-- Performance indexes for disposable menus system

-- Index for fast lookup by encrypted token (most common query)
CREATE INDEX IF NOT EXISTS idx_menus_token_status 
  ON disposable_menus(encrypted_url_token, status);

-- Index for listing active menus for a tenant
CREATE INDEX IF NOT EXISTS idx_active_menus 
  ON disposable_menus(tenant_id) 
  WHERE status = 'active';

-- Index for auto-burn queries (finding active menus with auto-burn enabled)
CREATE INDEX IF NOT EXISTS idx_pending_burns 
  ON disposable_menus(auto_burn_hours, created_at) 
  WHERE status = 'active' AND auto_burn_hours IS NOT NULL;

-- Index for whitelist checks
CREATE INDEX IF NOT EXISTS idx_whitelist_menu_status 
  ON menu_access_whitelist(menu_id, status);

-- Index for access logs (for analytics and velocity checks)
CREATE INDEX IF NOT EXISTS idx_logs_menu_timestamp 
  ON menu_access_logs(menu_id, accessed_at DESC);

-- Index for orders by menu
CREATE INDEX IF NOT EXISTS idx_orders_menu_id 
  ON menu_orders(menu_id);

-- Materialized view for real-time analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS menu_analytics_summary AS
SELECT 
  m.id as menu_id,
  m.tenant_id,
  COUNT(DISTINCT al.ip_address) as unique_visitors,
  COUNT(al.id) as total_views,
  COUNT(DISTINCT o.id) as order_count,
  COALESCE(SUM(o.total_amount), 0) as revenue,
  COALESCE(AVG(o.total_amount), 0) as avg_order_value,
  CASE 
    WHEN COUNT(DISTINCT al.ip_address) > 0 
    THEN COUNT(DISTINCT o.id)::float / COUNT(DISTINCT al.ip_address) 
    ELSE 0 
  END as conversion_rate,
  MAX(al.accessed_at) as last_accessed_at
FROM disposable_menus m
LEFT JOIN menu_access_logs al ON m.id = al.menu_id
LEFT JOIN menu_orders o ON m.id = o.menu_id
GROUP BY m.id, m.tenant_id;

-- Index for refreshing the view efficiently by menu_id
CREATE INDEX IF NOT EXISTS idx_analytics_menu_id ON menu_analytics_summary(menu_id);
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_id ON menu_analytics_summary(tenant_id);

-- Function to refresh the view (can be called by cron or triggers)
CREATE OR REPLACE FUNCTION refresh_menu_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY menu_analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Table to log security events (breaches, failed checks, etc.)
CREATE TABLE IF NOT EXISTS menu_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID REFERENCES disposable_menus(id),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
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
