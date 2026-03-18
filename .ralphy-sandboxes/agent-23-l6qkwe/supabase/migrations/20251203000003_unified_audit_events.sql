-- ============================================================================
-- UNIFIED AUDIT EVENTS TABLE
-- Consolidates: audit_logs, admin_audit_logs, super_admin_audit_logs,
--               menu_access_logs, menu_security_events, menu_screenshot_attempts,
--               menu_decryption_audit, phi_access_audit, security_events
-- ============================================================================

-- Create unified audit_events table (partitioned by month for performance)
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for super admin events
  
  -- Event categorization
  event_category text NOT NULL CHECK (event_category IN (
    'auth',           -- Login, logout, password changes
    'menu_access',    -- Menu views, link clicks
    'menu_security',  -- Screenshot attempts, device locks, geofence violations
    'data_access',    -- CRUD operations on sensitive data
    'admin_action',   -- Admin panel operations
    'phi_access',     -- HIPAA-related data access
    'order',          -- Order lifecycle events
    'inventory',      -- Stock changes, adjustments
    'billing',        -- Payment processing, subscription changes
    'integration',    -- Third-party API calls
    'system'          -- System events, errors, performance
  )),
  event_type text NOT NULL,  -- Specific event: 'login', 'screenshot_attempt', 'decrypt', etc.
  severity text DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  
  -- Actor information
  actor_type text CHECK (actor_type IN ('tenant_user', 'customer', 'super_admin', 'system', 'api', 'webhook')),
  actor_id uuid,
  actor_email text,
  actor_name text,
  
  -- Target information
  target_type text,  -- 'menu', 'order', 'customer', 'product', 'tenant', etc.
  target_id uuid,
  target_name text,
  
  -- Request context
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  session_id text,
  request_id text,
  
  -- Geo location
  geo_location jsonb,
  geo_country text,
  geo_city text,
  
  -- Event details (flexible JSON for type-specific data)
  details jsonb DEFAULT '{}',
  
  -- Outcome
  success boolean DEFAULT true,
  error_message text,
  error_code text,
  
  -- Timing
  duration_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Partition key
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the next 12 months
CREATE TABLE audit_events_2024_12 PARTITION OF audit_events
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_events_2025_02 PARTITION OF audit_events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_events_2025_03 PARTITION OF audit_events
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_events_2025_04 PARTITION OF audit_events
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_events_2025_05 PARTITION OF audit_events
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_events_2025_06 PARTITION OF audit_events
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_events_2025_07 PARTITION OF audit_events
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_events_2025_08 PARTITION OF audit_events
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_events_2025_09 PARTITION OF audit_events
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_events_2025_10 PARTITION OF audit_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_events_2025_11 PARTITION OF audit_events
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_events_2025_12 PARTITION OF audit_events
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Default partition for future dates (catches anything that doesn't fit existing partitions)
CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;

-- Performance indexes (created on parent, applies to all partitions)
CREATE INDEX idx_audit_events_tenant_category ON audit_events(tenant_id, event_category, created_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id, created_at DESC) WHERE target_id IS NOT NULL;
CREATE INDEX idx_audit_events_severity ON audit_events(tenant_id, severity, created_at DESC) WHERE severity IN ('warning', 'error', 'critical');
CREATE INDEX idx_audit_events_ip ON audit_events(ip_address, created_at DESC) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_audit_events_session ON audit_events(session_id, created_at DESC) WHERE session_id IS NOT NULL;

-- BRIN index for time-based queries (very efficient for partitioned tables)
CREATE INDEX idx_audit_events_created_brin ON audit_events USING BRIN(created_at);

-- ============================================================================
-- BACKWARD-COMPATIBLE VIEWS
-- ============================================================================

-- View: menu_access_logs_unified
CREATE OR REPLACE VIEW menu_access_logs_unified AS
SELECT
  ae.id,
  ae.tenant_id,
  (ae.details->>'menu_id')::uuid as menu_id,
  (ae.details->>'whitelist_id')::uuid as whitelist_id,
  ae.ip_address,
  ae.user_agent,
  ae.device_fingerprint,
  ae.geo_location as location_data,
  ae.geo_country as country,
  ae.geo_city as city,
  ae.success as access_granted,
  ae.error_message as denial_reason,
  ae.created_at
FROM audit_events ae
WHERE ae.event_category = 'menu_access'
  AND ae.event_type IN ('menu_view', 'menu_access');

-- View: menu_security_events_unified
CREATE OR REPLACE VIEW menu_security_events_unified AS
SELECT
  ae.id,
  ae.tenant_id,
  (ae.details->>'menu_id')::uuid as menu_id,
  ae.event_type,
  ae.severity,
  ae.ip_address,
  ae.device_fingerprint,
  ae.details,
  ae.created_at
FROM audit_events ae
WHERE ae.event_category = 'menu_security';

-- View: admin_audit_logs_unified
CREATE OR REPLACE VIEW admin_audit_logs_unified AS
SELECT
  ae.id,
  ae.tenant_id,
  ae.actor_id as user_id,
  ae.actor_email,
  ae.event_type as action,
  ae.target_type as resource_type,
  ae.target_id as resource_id,
  ae.details,
  ae.ip_address,
  ae.created_at
FROM audit_events ae
WHERE ae.event_category = 'admin_action'
  AND ae.actor_type = 'tenant_user';

-- View: super_admin_audit_logs_unified  
CREATE OR REPLACE VIEW super_admin_audit_logs_unified AS
SELECT
  ae.id,
  ae.actor_id as admin_id,
  ae.actor_email as admin_email,
  ae.event_type as action,
  ae.target_type,
  ae.target_id,
  (ae.details->>'target_tenant_id')::uuid as target_tenant_id,
  ae.details,
  ae.ip_address,
  ae.created_at
FROM audit_events ae
WHERE ae.event_category = 'admin_action'
  AND ae.actor_type = 'super_admin';

-- View: phi_access_audit_unified
CREATE OR REPLACE VIEW phi_access_audit_unified AS
SELECT
  ae.id,
  ae.tenant_id,
  ae.actor_id as user_id,
  ae.actor_email,
  ae.event_type as access_type,
  ae.target_type as phi_type,
  ae.target_id as record_id,
  ae.details->>'reason' as access_reason,
  ae.ip_address,
  ae.created_at
FROM audit_events ae
WHERE ae.event_category = 'phi_access';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Tenant users can see their own tenant's audit events
CREATE POLICY "audit_events_tenant_read" ON audit_events
FOR SELECT USING (
  tenant_id IS NULL  -- Super admin events visible to super admins only (handled separately)
  OR tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Only super admins can see global (tenant_id = NULL) events
CREATE POLICY "audit_events_super_admin_read" ON audit_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM super_admin_users WHERE user_id = auth.uid()
  )
);

-- Insert policy (services can insert)
CREATE POLICY "audit_events_insert" ON audit_events
FOR INSERT WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to log an audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id uuid DEFAULT NULL,
  p_category text DEFAULT 'system',
  p_event_type text DEFAULT 'unknown',
  p_severity text DEFAULT 'info',
  p_actor_type text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_actor_email text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO audit_events (
    tenant_id, event_category, event_type, severity,
    actor_type, actor_id, actor_email,
    target_type, target_id,
    details, ip_address, user_agent,
    success, error_message
  ) VALUES (
    p_tenant_id, p_category, p_event_type, p_severity,
    p_actor_type, p_actor_id, p_actor_email,
    p_target_type, p_target_id,
    p_details, p_ip_address, p_user_agent,
    p_success, p_error_message
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to log menu access
CREATE OR REPLACE FUNCTION log_menu_access(
  p_tenant_id uuid,
  p_menu_id uuid,
  p_whitelist_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL,
  p_geo_data jsonb DEFAULT NULL,
  p_access_granted boolean DEFAULT true,
  p_denial_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN log_audit_event(
    p_tenant_id := p_tenant_id,
    p_category := 'menu_access',
    p_event_type := CASE WHEN p_access_granted THEN 'menu_view' ELSE 'menu_denied' END,
    p_severity := CASE WHEN p_access_granted THEN 'info' ELSE 'warning' END,
    p_target_type := 'menu',
    p_target_id := p_menu_id,
    p_details := jsonb_build_object(
      'menu_id', p_menu_id,
      'whitelist_id', p_whitelist_id,
      'device_fingerprint', p_device_fingerprint
    ),
    p_ip_address := p_ip_address,
    p_user_agent := p_user_agent,
    p_success := p_access_granted,
    p_error_message := p_denial_reason
  );
END;
$$;

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_tenant_id uuid,
  p_event_type text,  -- 'screenshot_attempt', 'device_lock_violation', 'geofence_violation', etc.
  p_severity text DEFAULT 'warning',
  p_menu_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN log_audit_event(
    p_tenant_id := p_tenant_id,
    p_category := 'menu_security',
    p_event_type := p_event_type,
    p_severity := p_severity,
    p_target_type := 'menu',
    p_target_id := p_menu_id,
    p_details := p_details || jsonb_build_object('device_fingerprint', p_device_fingerprint),
    p_ip_address := p_ip_address,
    p_success := false
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_menu_access TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;

-- ============================================================================
-- PARTITION MAINTENANCE
-- ============================================================================

-- Function to create future partitions (run monthly via cron)
CREATE OR REPLACE FUNCTION create_audit_partition(
  p_year integer,
  p_month integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition_name text;
  v_start_date date;
  v_end_date date;
BEGIN
  v_partition_name := format('audit_events_%s_%s', p_year, LPAD(p_month::text, 2, '0'));
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + interval '1 month';
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = v_partition_name
      AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_start_date, v_end_date
    );
  END IF;
END;
$$;

-- Function to drop old partitions (data retention)
CREATE OR REPLACE FUNCTION drop_old_audit_partitions(
  p_months_to_keep integer DEFAULT 12
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date date;
  v_partition_name text;
  v_dropped_count integer := 0;
BEGIN
  v_cutoff_date := date_trunc('month', now() - (p_months_to_keep || ' months')::interval);
  
  FOR v_partition_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class parent ON parent.oid = i.inhparent
    WHERE parent.relname = 'audit_events'
      AND n.nspname = 'public'
      AND c.relname ~ '^audit_events_\d{4}_\d{2}$'
  LOOP
    -- Extract date from partition name and check if it's older than cutoff
    IF to_date(substring(v_partition_name from '\d{4}_\d{2}'), 'YYYY_MM') < v_cutoff_date THEN
      EXECUTE format('DROP TABLE %I', v_partition_name);
      v_dropped_count := v_dropped_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_dropped_count;
END;
$$;

COMMENT ON TABLE audit_events IS 'Unified partitioned audit log consolidating all security, access, and activity events';
COMMENT ON FUNCTION log_audit_event IS 'Generic function to log any audit event';
COMMENT ON FUNCTION log_menu_access IS 'Convenience function to log menu access events';
COMMENT ON FUNCTION log_security_event IS 'Convenience function to log security-related events';

