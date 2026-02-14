-- API Logs Table
-- Tracks all API requests for monitoring and analytics

CREATE TABLE IF NOT EXISTS api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  timestamp timestamptz DEFAULT now(),
  user_agent text,
  ip_address text,
  request_body jsonb,
  response_body jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_api_logs_tenant ON api_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all logs
CREATE POLICY "Super admins can view api logs"
  ON api_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Policy: Service role can insert logs (for edge functions)
CREATE POLICY "Service role can insert api logs"
  ON api_logs
  FOR INSERT
  WITH CHECK (true);

-- Retention policy: Delete logs older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM api_logs
  WHERE timestamp < now() - INTERVAL '90 days';
END;
$$;

COMMENT ON TABLE api_logs IS 'Stores API request logs for monitoring and analytics';
COMMENT ON COLUMN api_logs.endpoint IS 'API endpoint path (e.g., /api/orders)';
COMMENT ON COLUMN api_logs.method IS 'HTTP method (GET, POST, PUT, DELETE, etc.)';
COMMENT ON COLUMN api_logs.response_time_ms IS 'Response time in milliseconds';

