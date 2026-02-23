-- Saved Reports Table
-- Custom report configurations that can be scheduled

CREATE TABLE IF NOT EXISTS saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES super_admins(id),
  config jsonb NOT NULL,
  schedule text,
  recipients text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_run_at timestamptz,
  enabled boolean DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_enabled ON saved_reports(enabled);

-- Enable Row Level Security
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can manage reports
CREATE POLICY "Super admins can manage reports"
  ON saved_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE saved_reports IS 'Stores saved report configurations';
COMMENT ON COLUMN saved_reports.config IS 'JSON configuration for the report (metrics, dimensions, filters)';
COMMENT ON COLUMN saved_reports.schedule IS 'Cron expression for scheduled reports';

