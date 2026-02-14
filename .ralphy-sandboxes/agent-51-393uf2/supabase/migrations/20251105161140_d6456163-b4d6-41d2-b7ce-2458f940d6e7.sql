-- ============================================================================
-- WORKFLOW VERSIONING SYSTEM
-- Track changes to workflow definitions with rollback support
-- ============================================================================

-- Workflow Versions Table
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB,
  is_active BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  change_summary TEXT,
  change_details JSONB,
  restored_from_version INTEGER,
  UNIQUE(workflow_id, version_number)
);

CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id, version_number DESC);
CREATE INDEX idx_workflow_versions_tenant ON workflow_versions(tenant_id);
CREATE INDEX idx_workflow_versions_created ON workflow_versions(created_at DESC);

-- Function to create version on workflow update
CREATE OR REPLACE FUNCTION create_workflow_version()
RETURNS TRIGGER AS $$
DECLARE
  v_version_number INTEGER;
  v_change_summary TEXT;
  v_change_details JSONB := '{}'::jsonb;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number
  FROM workflow_versions
  WHERE workflow_id = NEW.id;

  -- Detect changes
  IF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      v_change_summary := 'Name changed';
      v_change_details := v_change_details || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
    END IF;
    
    IF OLD.actions IS DISTINCT FROM NEW.actions THEN
      v_change_summary := COALESCE(v_change_summary || ', ', '') || 'Actions modified';
      v_change_details := v_change_details || jsonb_build_object('actions_changed', true);
    END IF;
    
    IF OLD.trigger_config IS DISTINCT FROM NEW.trigger_config THEN
      v_change_summary := COALESCE(v_change_summary || ', ', '') || 'Trigger updated';
      v_change_details := v_change_details || jsonb_build_object('trigger_changed', true);
    END IF;
    
    IF OLD.conditions IS DISTINCT FROM NEW.conditions THEN
      v_change_summary := COALESCE(v_change_summary || ', ', '') || 'Conditions updated';
      v_change_details := v_change_details || jsonb_build_object('conditions_changed', true);
    END IF;
    
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_change_summary := COALESCE(v_change_summary || ', ', '') || (CASE WHEN NEW.is_active THEN 'Activated' ELSE 'Deactivated' END);
      v_change_details := v_change_details || jsonb_build_object('activation_changed', true);
    END IF;
    
    IF v_change_summary IS NULL THEN
      v_change_summary := 'Workflow updated';
    END IF;
  ELSE
    v_change_summary := 'Workflow created';
  END IF;

  -- Create version record
  INSERT INTO workflow_versions (
    workflow_id,
    tenant_id,
    version_number,
    name,
    description,
    trigger_type,
    trigger_config,
    actions,
    conditions,
    is_active,
    created_by,
    change_summary,
    change_details
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    v_version_number,
    NEW.name,
    NEW.description,
    NEW.trigger_type,
    NEW.trigger_config,
    NEW.actions,
    NEW.conditions,
    NEW.is_active,
    auth.uid(),
    v_change_summary,
    v_change_details
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for versioning
DROP TRIGGER IF EXISTS workflow_versioning_trigger ON workflow_definitions;
CREATE TRIGGER workflow_versioning_trigger
  AFTER INSERT OR UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION create_workflow_version();

-- Function to restore workflow from version
CREATE OR REPLACE FUNCTION restore_workflow_version(
  p_workflow_id UUID,
  p_version_number INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_version workflow_versions%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Get version
  SELECT * INTO v_version
  FROM workflow_versions
  WHERE workflow_id = p_workflow_id
    AND version_number = p_version_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Version not found');
  END IF;

  -- Update workflow with version data
  UPDATE workflow_definitions
  SET
    name = v_version.name,
    description = v_version.description,
    trigger_type = v_version.trigger_type,
    trigger_config = v_version.trigger_config,
    actions = v_version.actions,
    conditions = v_version.conditions,
    updated_at = NOW()
  WHERE id = p_workflow_id;

  -- Mark new version as restored
  UPDATE workflow_versions
  SET restored_from_version = p_version_number
  WHERE workflow_id = p_workflow_id
    AND version_number = (
      SELECT MAX(version_number)
      FROM workflow_versions
      WHERE workflow_id = p_workflow_id
    );

  v_result := jsonb_build_object(
    'success', true,
    'restored_version', p_version_number,
    'workflow_id', p_workflow_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare two versions
CREATE OR REPLACE FUNCTION compare_workflow_versions(
  p_workflow_id UUID,
  p_version_a INTEGER,
  p_version_b INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_version_a workflow_versions%ROWTYPE;
  v_version_b workflow_versions%ROWTYPE;
  v_diff JSONB := '{}'::jsonb;
BEGIN
  -- Get both versions
  SELECT * INTO v_version_a FROM workflow_versions 
  WHERE workflow_id = p_workflow_id AND version_number = p_version_a;
  
  SELECT * INTO v_version_b FROM workflow_versions 
  WHERE workflow_id = p_workflow_id AND version_number = p_version_b;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'One or both versions not found');
  END IF;

  -- Compare fields
  IF v_version_a.name != v_version_b.name THEN
    v_diff := v_diff || jsonb_build_object('name', jsonb_build_object('a', v_version_a.name, 'b', v_version_b.name));
  END IF;

  IF v_version_a.actions IS DISTINCT FROM v_version_b.actions THEN
    v_diff := v_diff || jsonb_build_object('actions', jsonb_build_object('changed', true));
  END IF;

  IF v_version_a.trigger_config IS DISTINCT FROM v_version_b.trigger_config THEN
    v_diff := v_diff || jsonb_build_object('trigger_config', jsonb_build_object('changed', true));
  END IF;

  IF v_version_a.conditions IS DISTINCT FROM v_version_b.conditions THEN
    v_diff := v_diff || jsonb_build_object('conditions', jsonb_build_object('changed', true));
  END IF;

  RETURN v_diff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own workflow versions"
  ON workflow_versions FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage workflow versions"
  ON workflow_versions FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE workflow_versions IS 'Version history for workflow definitions with rollback support';
COMMENT ON FUNCTION create_workflow_version() IS 'Automatically creates version on workflow changes';
COMMENT ON FUNCTION restore_workflow_version(UUID, INTEGER) IS 'Restores workflow to a previous version';
COMMENT ON FUNCTION compare_workflow_versions(UUID, INTEGER, INTEGER) IS 'Compares two workflow versions';