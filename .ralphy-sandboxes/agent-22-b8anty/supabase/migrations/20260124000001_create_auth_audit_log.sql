-- ============================================================================
-- AUTH AUDIT LOG TABLE
-- ============================================================================
-- Tracks authentication-related events for security auditing and compliance.
-- Separate from the general audit_logs table to focus on auth-specific events.
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failed',
    'logout',
    'password_reset',
    'password_change',
    'email_change',
    'account_locked',
    'account_unlocked',
    'session_revoked',
    'signup_started',
    'signup_completed'
  )),
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for querying by user, event type, and time range
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_event_created
  ON auth_audit_log (user_id, event_type, created_at DESC);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_tenant_id
  ON auth_audit_log (tenant_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at
  ON auth_audit_log (created_at DESC);

-- Enable Row Level Security
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant admins can read auth audit logs for their tenant
CREATE POLICY "Tenant admins can read auth audit logs"
  ON auth_audit_log
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Policy: Service role can insert auth audit log entries (for backend/edge functions)
CREATE POLICY "Service role can insert auth audit logs"
  ON auth_audit_log
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE auth_audit_log IS 'Authentication event audit trail for security monitoring and compliance';
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of auth event: login_success, login_failed, logout, password_reset, password_change, email_change, account_locked, account_unlocked, session_revoked, signup_started, signup_completed';
COMMENT ON COLUMN auth_audit_log.ip_address IS 'Client IP address at time of event';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event-specific data (e.g., failure reason, device info)';
