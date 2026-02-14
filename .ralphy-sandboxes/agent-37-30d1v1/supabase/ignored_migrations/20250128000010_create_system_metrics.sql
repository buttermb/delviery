-- System Metrics Table for Real-Time Monitoring
-- Tracks CPU, memory, disk, API latency, and error rates

CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'api_latency', 'error_rate', 'database_connections', 'active_tenants')),
  value numeric NOT NULL,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_timestamp ON system_metrics(metric_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Only super admins can read system metrics
CREATE POLICY "Super admins can view system metrics"
  ON system_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

-- Policy: Service role can insert metrics (for edge functions)
CREATE POLICY "Service role can insert metrics"
  ON system_metrics
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE system_metrics;

-- Retention policy: Delete metrics older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM system_metrics
  WHERE timestamp < now() - INTERVAL '90 days';
END;
$$;

COMMENT ON TABLE system_metrics IS 'Stores real-time system health metrics for platform monitoring';
COMMENT ON COLUMN system_metrics.metric_type IS 'Type of metric: cpu, memory, disk, api_latency, error_rate, database_connections, active_tenants';
COMMENT ON COLUMN system_metrics.value IS 'Numeric value of the metric';
COMMENT ON COLUMN system_metrics.metadata IS 'Additional context about the metric (e.g., endpoint, error details)';

