-- Fix SECURITY DEFINER functions missing SET search_path = public
-- Security Issue: Functions without search_path can be hijacked via schema manipulation

-- 1. Fix trigger_workflow_on_database_event
CREATE OR REPLACE FUNCTION public.trigger_workflow_on_database_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workflow RECORD;
  execution_id UUID;
BEGIN
  FOR workflow IN
    SELECT wd.*, wt.conditions
    FROM workflow_definitions wd
    JOIN workflow_triggers wt ON wd.id = wt.workflow_id
    WHERE wd.is_active = true
      AND wt.table_name = TG_TABLE_NAME
      AND wt.event_type = TG_OP
      AND wd.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
  LOOP
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

    UPDATE workflow_definitions
    SET 
      last_run_at = now(),
      run_count = run_count + 1
    WHERE id = workflow.id;
    
    RAISE NOTICE 'Workflow % triggered by % on %.%', workflow.name, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Fix move_to_dead_letter_queue
CREATE OR REPLACE FUNCTION public.move_to_dead_letter_queue(p_execution_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 3. Fix retry_from_dead_letter_queue
CREATE OR REPLACE FUNCTION public.retry_from_dead_letter_queue(
  p_dlq_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 4. Fix resolve_dead_letter_entry
CREATE OR REPLACE FUNCTION public.resolve_dead_letter_entry(
  p_dlq_id uuid,
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 5. Fix emergency_wipe
CREATE OR REPLACE FUNCTION public.emergency_wipe(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the emergency wipe event FIRST
  INSERT INTO security_events (tenant_id, event_type, details, created_at)
  VALUES (
    emergency_wipe.tenant_id,
    'emergency_wipe',
    jsonb_build_object(
      'timestamp', NOW(),
      'action', 'panic_button_activated'
    ),
    NOW()
  );

  -- Delete all sensitive data
  DELETE FROM orders WHERE orders.tenant_id = emergency_wipe.tenant_id;
  DELETE FROM customers WHERE customers.tenant_id = emergency_wipe.tenant_id;
  DELETE FROM products WHERE products.tenant_id = emergency_wipe.tenant_id;
  DELETE FROM disposable_menus WHERE disposable_menus.tenant_id = emergency_wipe.tenant_id;
  DELETE FROM menu_orders WHERE menu_orders.tenant_id = emergency_wipe.tenant_id;
  
  -- Log completion
  INSERT INTO security_events (tenant_id, event_type, details, created_at)
  VALUES (
    emergency_wipe.tenant_id,
    'emergency_wipe_completed',
    jsonb_build_object(
      'timestamp', NOW(),
      'status', 'completed'
    ),
    NOW()
  );
END;
$$;

-- 6. Fix refresh_dashboard_metrics
CREATE OR REPLACE FUNCTION public.refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics;
END;
$$;