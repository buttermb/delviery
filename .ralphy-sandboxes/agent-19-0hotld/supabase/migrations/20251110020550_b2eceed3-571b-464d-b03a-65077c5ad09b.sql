-- Fix remaining SECURITY DEFINER functions by adding SET search_path = public
-- This prevents privilege escalation attacks via schema manipulation

-- 1. auto_assign_tenant_id
CREATE OR REPLACE FUNCTION public.auto_assign_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT a.tenant_id INTO NEW.tenant_id
    FROM public.profiles p
    JOIN public.accounts a ON p.account_id = a.id
    WHERE p.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. update_last_access_timestamp
CREATE OR REPLACE FUNCTION public.update_last_access_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.menu_access_whitelist
  SET 
    last_access_at = NEW.accessed_at,
    view_count = view_count + 1,
    first_access_at = COALESCE(first_access_at, NEW.accessed_at)
  WHERE id = NEW.access_whitelist_id;
  RETURN NEW;
END;
$function$;

-- 3. trigger_workflow_on_database_event
CREATE OR REPLACE FUNCTION public.trigger_workflow_on_database_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 4. create_workflow_version
CREATE OR REPLACE FUNCTION public.create_workflow_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_version_number INTEGER;
  v_change_summary TEXT;
  v_change_details JSONB := '{}'::jsonb;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number
  FROM workflow_versions
  WHERE workflow_id = NEW.id;

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
$function$;

-- 5. restore_workflow_version
CREATE OR REPLACE FUNCTION public.restore_workflow_version(p_workflow_id uuid, p_version_number integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_version workflow_versions%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_version
  FROM workflow_versions
  WHERE workflow_id = p_workflow_id
    AND version_number = p_version_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Version not found');
  END IF;

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
$function$;

-- 6. compare_workflow_versions
CREATE OR REPLACE FUNCTION public.compare_workflow_versions(p_workflow_id uuid, p_version_a integer, p_version_b integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_version_a workflow_versions%ROWTYPE;
  v_version_b workflow_versions%ROWTYPE;
  v_diff JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_version_a FROM workflow_versions 
  WHERE workflow_id = p_workflow_id AND version_number = p_version_a;
  
  SELECT * INTO v_version_b FROM workflow_versions 
  WHERE workflow_id = p_workflow_id AND version_number = p_version_b;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'One or both versions not found');
  END IF;

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
$function$;

-- 7. move_to_dead_letter_queue
CREATE OR REPLACE FUNCTION public.move_to_dead_letter_queue(p_execution_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 8. retry_from_dead_letter_queue
CREATE OR REPLACE FUNCTION public.retry_from_dead_letter_queue(p_dlq_id uuid, p_user_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 9. resolve_dead_letter_entry
CREATE OR REPLACE FUNCTION public.resolve_dead_letter_entry(p_dlq_id uuid, p_user_id uuid, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 10. get_route_statistics
CREATE OR REPLACE FUNCTION public.get_route_statistics(p_runner_id uuid, p_delivery_id uuid DEFAULT NULL::uuid, p_start_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(total_distance numeric, total_duration interval, average_speed numeric, max_speed numeric, points_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(lag_lat)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(lag_lng)) + 
          sin(radians(lag_lat)) * sin(radians(latitude))
        ))
      )
    ), 0) as total_distance,
    COALESCE(MAX(recorded_at) - MIN(recorded_at), INTERVAL '0') as total_duration,
    COALESCE(AVG(speed), 0) as average_speed,
    COALESCE(MAX(speed), 0) as max_speed,
    COUNT(*)::INTEGER as points_count
  FROM (
    SELECT
      latitude,
      longitude,
      speed,
      recorded_at,
      LAG(latitude) OVER (ORDER BY recorded_at) as lag_lat,
      LAG(longitude) OVER (ORDER BY recorded_at) as lag_lng
    FROM public.runner_location_history
    WHERE runner_id = p_runner_id
      AND (p_delivery_id IS NULL OR delivery_id = p_delivery_id)
      AND (p_start_time IS NULL OR recorded_at >= p_start_time)
      AND (p_end_time IS NULL OR recorded_at <= p_end_time)
    ORDER BY recorded_at
  ) subquery
  WHERE lag_lat IS NOT NULL;
END;
$function$;

-- 11. cleanup_old_location_history
CREATE OR REPLACE FUNCTION public.cleanup_old_location_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.runner_location_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$function$;

-- 12. increment_runner_deliveries
CREATE OR REPLACE FUNCTION public.increment_runner_deliveries(p_runner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.wholesale_runners
  SET 
    total_deliveries = total_deliveries + 1,
    updated_at = NOW()
  WHERE id = p_runner_id;
END;
$function$;

-- 13. auto_assign_order_tenant
CREATE OR REPLACE FUNCTION public.auto_assign_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.merchant_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.merchants
    WHERE id = NEW.merchant_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 14. create_super_admin_with_password
CREATE OR REPLACE FUNCTION public.create_super_admin_with_password(p_email text, p_first_name text, p_last_name text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin_id UUID;
BEGIN
  INSERT INTO super_admin_users (email, first_name, last_name, password_hash, role, status)
  VALUES (
    lower(p_email),
    p_first_name,
    p_last_name,
    encode(digest(p_password || 'temp_salt', 'sha256'), 'hex'),
    'super_admin',
    'active'
  )
  ON CONFLICT (email) DO UPDATE
  SET password_hash = encode(digest(p_password || 'temp_salt', 'sha256'), 'hex'),
      updated_at = now()
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$function$;

COMMENT ON FUNCTION public.auto_assign_tenant_id IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.update_last_access_timestamp IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.trigger_workflow_on_database_event IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.create_workflow_version IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.restore_workflow_version IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.compare_workflow_versions IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.move_to_dead_letter_queue IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.retry_from_dead_letter_queue IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.resolve_dead_letter_entry IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.get_route_statistics IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.cleanup_old_location_history IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.increment_runner_deliveries IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.auto_assign_order_tenant IS 'Fixed: Added SET search_path = public for security';
COMMENT ON FUNCTION public.create_super_admin_with_password IS 'Fixed: Added SET search_path = public for security';