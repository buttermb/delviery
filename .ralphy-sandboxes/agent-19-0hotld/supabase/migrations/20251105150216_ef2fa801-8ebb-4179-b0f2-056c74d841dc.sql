-- Workflow Automation System
-- Tables for storing workflow definitions, triggers, and execution history

-- Workflow Definitions Table
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('database_event', 'schedule', 'webhook', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0
);

CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX idx_workflow_definitions_trigger ON workflow_definitions(trigger_type) WHERE is_active = true;

-- Workflow Executions Table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  trigger_data JSONB,
  execution_log JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id, started_at DESC);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status, started_at DESC);
CREATE INDEX idx_workflow_executions_tenant ON workflow_executions(tenant_id);

-- Workflow Triggers Table (for database event triggers)
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_triggers_table ON workflow_triggers(table_name, event_type);
CREATE INDEX idx_workflow_triggers_workflow ON workflow_triggers(workflow_id);

-- Workflow Action Templates Table
CREATE TABLE IF NOT EXISTS workflow_action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('notification', 'database', 'api', 'logic', 'integration')),
  description TEXT,
  icon TEXT,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  edge_function_name TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default action templates
INSERT INTO workflow_action_templates (name, category, description, icon, input_schema, edge_function_name, is_system) VALUES
  ('send_email', 'notification', 'Send email notification', '📧', '{"to": "string", "subject": "string", "body": "string"}', 'send-email-notification', true),
  ('send_sms', 'notification', 'Send SMS notification', '💬', '{"to": "string", "message": "string"}', 'send-sms', true),
  ('create_order', 'database', 'Create new order', '🛒', '{"customer_id": "uuid", "items": "array"}', 'create-order', true),
  ('update_inventory', 'database', 'Update inventory levels', '📦', '{"product_id": "uuid", "quantity": "number"}', 'update-inventory', true),
  ('call_webhook', 'api', 'Call external webhook', '🔗', '{"url": "string", "method": "string", "body": "object"}', 'call-webhook', true),
  ('assign_courier', 'database', 'Assign courier to order', '🚚', '{"order_id": "uuid", "courier_id": "uuid"}', 'assign-courier', true),
  ('calculate_eta', 'api', 'Calculate delivery ETA', '⏱️', '{"order_id": "uuid"}', 'calculate-eta', true)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_action_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_definitions
CREATE POLICY "workflow_definitions_tenant_isolation" ON workflow_definitions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_executions
CREATE POLICY "workflow_executions_tenant_isolation" ON workflow_executions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_triggers
CREATE POLICY "workflow_triggers_tenant_isolation" ON workflow_triggers
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for workflow_action_templates (read-only for all authenticated users)
CREATE POLICY "workflow_action_templates_read" ON workflow_action_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Function to trigger workflows on database events
CREATE OR REPLACE FUNCTION trigger_workflow_on_database_event()
RETURNS TRIGGER AS $$
DECLARE
  workflow RECORD;
  execution_id UUID;
BEGIN
  -- Find matching workflows for this table and event type
  FOR workflow IN
    SELECT wd.*, wt.conditions
    FROM workflow_definitions wd
    JOIN workflow_triggers wt ON wd.id = wt.workflow_id
    WHERE wd.is_active = true
      AND wt.table_name = TG_TABLE_NAME
      AND wt.event_type = TG_OP
      AND wd.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
  LOOP
    -- Create execution record
    INSERT INTO workflow_executions (
      workflow_id,
      tenant_id,
      status,
      trigger_data
    ) VALUES (
      workflow.id,
      COALESCE(NEW.tenant_id, OLD.tenant_id),
      'queued',
      jsonb_build_object(
        'event', TG_OP,
        'table', TG_TABLE_NAME,
        'old_data', to_jsonb(OLD),
        'new_data', to_jsonb(NEW)
      )
    ) RETURNING id INTO execution_id;

    -- Update workflow run stats
    UPDATE workflow_definitions
    SET 
      last_run_at = now(),
      run_count = run_count + 1
    WHERE id = workflow.id;
    
    -- Log the trigger (you can enhance this to call an edge function)
    RAISE NOTICE 'Workflow % triggered by % on %.%', workflow.name, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add workflow triggers to key tables
CREATE TRIGGER workflow_trigger_orders_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflow_on_database_event();

CREATE TRIGGER workflow_trigger_orders_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflow_on_database_event();

CREATE TRIGGER workflow_trigger_wholesale_orders_insert
  AFTER INSERT ON wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflow_on_database_event();

CREATE TRIGGER workflow_trigger_wholesale_orders_update
  AFTER UPDATE ON wholesale_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_workflow_on_database_event();

-- Update timestamp trigger
CREATE TRIGGER update_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();