-- Rate Limits Table
-- Per-tenant rate limiting configuration and tracking

CREATE TABLE IF NOT EXISTS rate_limits (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  requests_per_hour integer DEFAULT 1000,
  requests_per_day integer DEFAULT 10000,
  requests_per_month integer DEFAULT 100000,
  custom_limits jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Rate Limit Violations Table
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  endpoint text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  violation_type text NOT NULL CHECK (violation_type IN ('hourly', 'daily', 'monthly')),
  current_count integer NOT NULL,
  limit_value integer NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_tenant ON rate_limit_violations(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_type ON rate_limit_violations(violation_type, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Policies for rate_limits
CREATE POLICY "Super admins can view rate limits"
  ON rate_limits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage rate limits"
  ON rate_limits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Policies for rate_limit_violations
CREATE POLICY "Super admins can view violations"
  ON rate_limit_violations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert violations"
  ON rate_limit_violations
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE rate_limits IS 'Stores rate limiting configuration per tenant';
COMMENT ON TABLE rate_limit_violations IS 'Tracks rate limit violations for monitoring';

