-- Feature Flags Table
-- Feature flag management system

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_tenants uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tenant Feature Overrides Table
CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, flag_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_tenant ON tenant_feature_overrides(tenant_id);

-- Enable Row Level Security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Super admins can manage feature flags"
  ON feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage overrides"
  ON tenant_feature_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE feature_flags IS 'Platform-wide feature flags';
COMMENT ON TABLE tenant_feature_overrides IS 'Per-tenant feature flag overrides';

