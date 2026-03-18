-- Create tenant_settings_versions table for tracking settings history
-- Stores the last 10 versions of settings per category per tenant

CREATE TABLE IF NOT EXISTS tenant_settings_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Settings category (e.g., 'business', 'payment', 'notifications', 'appearance')
  settings_key VARCHAR(50) NOT NULL,
  -- Complete settings snapshot at this save
  snapshot JSONB NOT NULL,
  -- Which fields changed from previous version (for quick display)
  changed_fields JSONB DEFAULT '[]'::jsonb,
  -- User who made the change
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_email TEXT,
  -- Version metadata
  version_number INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries (latest versions per tenant/key)
CREATE INDEX IF NOT EXISTS idx_tenant_settings_versions_lookup
  ON tenant_settings_versions(tenant_id, settings_key, created_at DESC);

-- Index for cleanup job (oldest versions)
CREATE INDEX IF NOT EXISTS idx_tenant_settings_versions_cleanup
  ON tenant_settings_versions(tenant_id, settings_key, version_number);

-- Enable RLS
ALTER TABLE tenant_settings_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view their own settings versions"
  ON tenant_settings_versions FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can insert their own settings versions"
  ON tenant_settings_versions FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can delete their own settings versions"
  ON tenant_settings_versions FOR DELETE
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

-- Function to save settings version and maintain only last 10 versions
CREATE OR REPLACE FUNCTION save_settings_version(
  p_tenant_id UUID,
  p_settings_key VARCHAR(50),
  p_snapshot JSONB,
  p_changed_fields JSONB DEFAULT '[]'::jsonb,
  p_changed_by UUID DEFAULT NULL,
  p_changed_by_email TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id UUID;
  v_next_version INTEGER;
  v_count INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM tenant_settings_versions
  WHERE tenant_id = p_tenant_id AND settings_key = p_settings_key;

  -- Insert new version
  INSERT INTO tenant_settings_versions (
    tenant_id, settings_key, snapshot, changed_fields,
    changed_by, changed_by_email, version_number, description
  ) VALUES (
    p_tenant_id, p_settings_key, p_snapshot, p_changed_fields,
    p_changed_by, p_changed_by_email, v_next_version, p_description
  )
  RETURNING id INTO v_version_id;

  -- Count existing versions
  SELECT COUNT(*) INTO v_count
  FROM tenant_settings_versions
  WHERE tenant_id = p_tenant_id AND settings_key = p_settings_key;

  -- If more than 10 versions, delete oldest ones
  IF v_count > 10 THEN
    DELETE FROM tenant_settings_versions
    WHERE id IN (
      SELECT id FROM tenant_settings_versions
      WHERE tenant_id = p_tenant_id AND settings_key = p_settings_key
      ORDER BY created_at ASC
      LIMIT v_count - 10
    );
  END IF;

  RETURN v_version_id;
END;
$$;

-- Function to get settings versions for a tenant/key
CREATE OR REPLACE FUNCTION get_settings_versions(
  p_tenant_id UUID,
  p_settings_key VARCHAR(50),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  settings_key VARCHAR(50),
  snapshot JSONB,
  changed_fields JSONB,
  changed_by UUID,
  changed_by_email TEXT,
  version_number INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.settings_key,
    v.snapshot,
    v.changed_fields,
    v.changed_by,
    v.changed_by_email,
    v.version_number,
    v.description,
    v.created_at
  FROM tenant_settings_versions v
  WHERE v.tenant_id = p_tenant_id
    AND v.settings_key = p_settings_key
  ORDER BY v.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT ALL ON tenant_settings_versions TO authenticated;
GRANT EXECUTE ON FUNCTION save_settings_version TO authenticated;
GRANT EXECUTE ON FUNCTION get_settings_versions TO authenticated;

-- Add comments
COMMENT ON TABLE tenant_settings_versions IS 'Stores version history for tenant settings, keeping last 10 saves per category';
COMMENT ON FUNCTION save_settings_version IS 'Saves a new settings version and maintains only the last 10 versions per category';
COMMENT ON FUNCTION get_settings_versions IS 'Retrieves settings version history for a tenant and settings category';
