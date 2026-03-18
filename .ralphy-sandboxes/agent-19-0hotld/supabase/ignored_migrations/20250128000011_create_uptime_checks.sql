-- Uptime Checks Table
-- Tracks API endpoint availability and service health

CREATE TABLE IF NOT EXISTS uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  endpoint text NOT NULL,
  status text NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time_ms integer,
  checked_at timestamptz DEFAULT now(),
  error_message text,
  status_code integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_status ON uptime_checks(status, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at DESC);

-- Enable Row Level Security
ALTER TABLE uptime_checks ENABLE ROW LEVEL SECURITY;

-- Policy: Only super admins can view uptime checks
CREATE POLICY "Super admins can view uptime checks"
  ON uptime_checks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Policy: Service role can insert checks (for edge functions)
CREATE POLICY "Service role can insert uptime checks"
  ON uptime_checks
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE uptime_checks;

-- Retention policy: Delete checks older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_uptime_checks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM uptime_checks
  WHERE checked_at < now() - INTERVAL '90 days';
END;
$$;

-- View: Current service status (latest check per service)
CREATE OR REPLACE VIEW current_service_status AS
SELECT DISTINCT ON (service_name, endpoint)
  service_name,
  endpoint,
  status,
  response_time_ms,
  checked_at,
  error_message
FROM uptime_checks
ORDER BY service_name, endpoint, checked_at DESC;

COMMENT ON TABLE uptime_checks IS 'Stores uptime check results for monitoring service availability';
COMMENT ON COLUMN uptime_checks.service_name IS 'Name of the service being checked (e.g., API, Database, Edge Functions)';
COMMENT ON COLUMN uptime_checks.endpoint IS 'URL or endpoint being checked';
COMMENT ON COLUMN uptime_checks.status IS 'Current status: up, down, or degraded';
COMMENT ON COLUMN uptime_checks.response_time_ms IS 'Response time in milliseconds';

