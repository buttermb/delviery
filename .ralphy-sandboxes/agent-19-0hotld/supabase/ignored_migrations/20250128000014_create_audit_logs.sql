-- Audit Logs Table
-- Complete audit trail for all super admin and tenant admin actions

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('super_admin', 'tenant_admin', 'system', 'api')),
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  tenant_id uuid REFERENCES tenants(id),
  changes jsonb,
  ip_address text,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all audit logs
CREATE POLICY "Super admins can view audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Retention policy: Archive logs older than 1 year
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Archive old logs (move to separate archive table if needed)
  -- For now, just delete logs older than 1 year
  DELETE FROM audit_logs
  WHERE timestamp < now() - INTERVAL '1 year';
END;
$$;

COMMENT ON TABLE audit_logs IS 'Complete audit trail for all platform actions';
COMMENT ON COLUMN audit_logs.actor_type IS 'Type of actor: super_admin, tenant_admin, system, api';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., create, update, delete, login)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (e.g., tenant, order, user)';
COMMENT ON COLUMN audit_logs.changes IS 'JSON object with before/after values for changes';

