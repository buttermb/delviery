-- ============================================================================
-- WORKFLOW ERROR HANDLING & RETRY SYSTEM
-- Implements retry logic, exponential backoff, and dead letter queue
-- ============================================================================

-- Add retry configuration to workflow_definitions
ALTER TABLE workflow_definitions
ADD COLUMN IF NOT EXISTS retry_config JSONB DEFAULT jsonb_build_object(
  'max_attempts', 3,
  'initial_delay_seconds', 5,
  'max_delay_seconds', 300,
  'backoff_multiplier', 2,
  'retry_on_errors', ARRAY['timeout', 'network_error', 'rate_limit', 'server_error']
);

-- Add retry tracking to workflow_executions
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS error_details JSONB,
ADD COLUMN IF NOT EXISTS is_retryable BOOLEAN DEFAULT true;

-- Create dead letter queue table
CREATE TABLE IF NOT EXISTS workflow_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  
  -- Original execution data
  trigger_data JSONB,
  execution_log JSONB DEFAULT '[]'::jsonb,
  
  -- Error information
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_details JSONB,
  
  -- Retry history
  total_attempts INTEGER DEFAULT 0,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Resolution
  status TEXT DEFAULT 'failed' CHECK (status IN ('failed', 'retrying', 'resolved', 'ignored')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  
  -- Manual retry
  manual_retry_requested BOOLEAN DEFAULT false,
  manual_retry_requested_at TIMESTAMPTZ,
  manual_retry_requested_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dlq_workflow_id ON workflow_dead_letter_queue(workflow_id);
CREATE INDEX IF NOT EXISTS idx_dlq_tenant_id ON workflow_dead_letter_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON workflow_dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_dlq_created_at ON workflow_dead_letter_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_retry ON workflow_executions(status, next_retry_at) WHERE status = 'failed' AND is_retryable = true;

-- Enable RLS
ALTER TABLE workflow_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenants can view own dead letter queue"
  ON workflow_dead_letter_queue FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can update own dead letter queue"
  ON workflow_dead_letter_queue FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Function to calculate next retry delay with exponential backoff
CREATE OR REPLACE FUNCTION calculate_next_retry_delay(
  p_retry_count INTEGER,
  p_retry_config JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_initial_delay INTEGER;
  v_max_delay INTEGER;
  v_multiplier NUMERIC;
  v_calculated_delay INTEGER;
BEGIN
  v_initial_delay := COALESCE((p_retry_config->>'initial_delay_seconds')::INTEGER, 5);
  v_max_delay := COALESCE((p_retry_config->>'max_delay_seconds')::INTEGER, 300);
  v_multiplier := COALESCE((p_retry_config->>'backoff_multiplier')::NUMERIC, 2);
  
  v_calculated_delay := v_initial_delay * POWER(v_multiplier, p_retry_count);
  v_calculated_delay := LEAST(v_calculated_delay, v_max_delay);
  v_calculated_delay := v_calculated_delay * (1 + (RANDOM() * 0.2 - 0.1));
  
  RETURN v_calculated_delay;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if error is retryable
CREATE OR REPLACE FUNCTION is_error_retryable(
  p_error_type TEXT,
  p_retry_config JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_retry_on_errors TEXT[];
BEGIN
  v_retry_on_errors := ARRAY(
    SELECT jsonb_array_elements_text(p_retry_config->'retry_on_errors')
  );
  
  RETURN p_error_type = ANY(v_retry_on_errors);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to move failed execution to dead letter queue
CREATE OR REPLACE FUNCTION move_to_dead_letter_queue(
  p_execution_id UUID
) RETURNS UUID AS $$
DECLARE
  v_execution workflow_executions%ROWTYPE;
  v_dlq_id UUID;
BEGIN
  SELECT * INTO v_execution
  FROM workflow_executions
  WHERE id = p_execution_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution not found: %', p_execution_id;
  END IF;
  
  INSERT INTO workflow_dead_letter_queue (
    workflow_execution_id,
    workflow_id,
    tenant_id,
    trigger_data,
    execution_log,
    error_type,
    error_message,
    error_stack,
    error_details,
    total_attempts,
    first_failed_at,
    last_attempt_at,
    status
  ) VALUES (
    v_execution.id,
    v_execution.workflow_id,
    v_execution.tenant_id,
    v_execution.trigger_data,
    v_execution.execution_log,
    COALESCE((v_execution.error_details->>'error_type')::TEXT, 'unknown'),
    v_execution.last_error,
    v_execution.error_details->>'stack',
    v_execution.error_details,
    v_execution.retry_count,
    v_execution.created_at,
    NOW(),
    'failed'
  )
  RETURNING id INTO v_dlq_id;
  
  UPDATE workflow_executions
  SET 
    status = 'dead_letter',
    updated_at = NOW()
  WHERE id = p_execution_id;
  
  RETURN v_dlq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry execution from dead letter queue
CREATE OR REPLACE FUNCTION retry_from_dead_letter_queue(
  p_dlq_id UUID,
  p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_dlq workflow_dead_letter_queue%ROWTYPE;
  v_new_execution_id UUID;
BEGIN
  SELECT * INTO v_dlq
  FROM workflow_dead_letter_queue
  WHERE id = p_dlq_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dead letter queue entry not found: %', p_dlq_id;
  END IF;
  
  INSERT INTO workflow_executions (
    workflow_id,
    tenant_id,
    status,
    trigger_data,
    retry_count
  ) VALUES (
    v_dlq.workflow_id,
    v_dlq.tenant_id,
    'queued',
    v_dlq.trigger_data,
    0
  )
  RETURNING id INTO v_new_execution_id;
  
  UPDATE workflow_dead_letter_queue
  SET
    status = 'retrying',
    manual_retry_requested = true,
    manual_retry_requested_at = NOW(),
    manual_retry_requested_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_dlq_id;
  
  RETURN v_new_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark DLQ entry as resolved
CREATE OR REPLACE FUNCTION resolve_dead_letter_entry(
  p_dlq_id UUID,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE workflow_dead_letter_queue
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = p_user_id,
    resolution_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_dlq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE workflow_dead_letter_queue IS 'Stores failed workflow executions after all retries exhausted';
COMMENT ON FUNCTION calculate_next_retry_delay IS 'Calculates exponential backoff delay with jitter';
COMMENT ON FUNCTION is_error_retryable IS 'Checks if an error type is configured for retry';
COMMENT ON FUNCTION move_to_dead_letter_queue IS 'Moves a failed execution to the dead letter queue';