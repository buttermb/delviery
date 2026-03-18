-- ============================================================================
-- MENU EXPIRATION & AUTO-ARCHIVE
-- ============================================================================
-- Adds archiving support for menus with preserved analytics
-- Connects scheduling to menu lifecycle management
-- ============================================================================

-- Add archiving columns to disposable_menus
ALTER TABLE public.disposable_menus
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_reason TEXT DEFAULT NULL CHECK (
  archived_reason IS NULL OR archived_reason IN ('expired', 'manual', 'schedule_ended')
),
ADD COLUMN IF NOT EXISTS analytics_snapshot JSONB DEFAULT NULL;

-- Add 'archived' as a valid status
-- First check current constraint and update if needed
DO $$
BEGIN
  -- Check if the status column has a CHECK constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%disposable_menus_status%'
  ) THEN
    -- Drop the old constraint
    ALTER TABLE public.disposable_menus DROP CONSTRAINT IF EXISTS disposable_menus_status_check;
  END IF;
END $$;

-- Add index for archived menus lookup
CREATE INDEX IF NOT EXISTS idx_disposable_menus_archived
ON public.disposable_menus(archived_at)
WHERE archived_at IS NOT NULL;

-- Index for finding menus needing archival
CREATE INDEX IF NOT EXISTS idx_disposable_menus_expiration_check
ON public.disposable_menus(status, scheduled_deactivation_time)
WHERE status = 'active' AND scheduled_deactivation_time IS NOT NULL;

-- Function to archive a menu and preserve analytics
CREATE OR REPLACE FUNCTION public.archive_menu_with_analytics(
  p_menu_id UUID,
  p_reason TEXT DEFAULT 'expired'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu RECORD;
  v_analytics JSONB;
  v_view_count INTEGER;
  v_order_count INTEGER;
  v_total_revenue NUMERIC;
  v_conversion_rate NUMERIC;
BEGIN
  -- Get the menu
  SELECT * INTO v_menu FROM disposable_menus WHERE id = p_menu_id;

  IF v_menu IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Menu not found');
  END IF;

  -- Get view count from access logs
  SELECT COUNT(*) INTO v_view_count
  FROM menu_access_logs
  WHERE menu_id = p_menu_id;

  -- Get order stats
  SELECT
    COUNT(*),
    COALESCE(SUM(total_amount), 0)
  INTO v_order_count, v_total_revenue
  FROM menu_orders
  WHERE menu_id = p_menu_id;

  -- Calculate conversion rate
  v_conversion_rate := CASE
    WHEN v_view_count > 0 THEN (v_order_count::NUMERIC / v_view_count::NUMERIC) * 100
    ELSE 0
  END;

  -- Build analytics snapshot
  v_analytics := jsonb_build_object(
    'totalViews', v_view_count,
    'totalOrders', v_order_count,
    'totalRevenue', v_total_revenue,
    'conversionRate', ROUND(v_conversion_rate, 2),
    'archivedAt', now()::text
  );

  -- Update the menu to archived status
  UPDATE disposable_menus
  SET
    status = 'archived',
    archived_at = now(),
    archived_reason = p_reason,
    analytics_snapshot = v_analytics,
    is_scheduled = false,
    scheduled_activation_time = NULL,
    scheduled_deactivation_time = NULL
  WHERE id = p_menu_id;

  -- Log the archival
  INSERT INTO menu_schedule_history (
    menu_id,
    tenant_id,
    action,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    p_menu_id,
    v_menu.tenant_id,
    'deactivated',
    v_menu.status,
    'archived',
    jsonb_build_object('reason', p_reason, 'analyticsSnapshot', v_analytics)
  );

  RETURN jsonb_build_object(
    'success', true,
    'menuId', p_menu_id,
    'analyticsSnapshot', v_analytics
  );
END;
$$;

-- Function to reactivate an archived menu
CREATE OR REPLACE FUNCTION public.reactivate_archived_menu(
  p_menu_id UUID,
  p_new_activation_time TIMESTAMPTZ DEFAULT NULL,
  p_new_deactivation_time TIMESTAMPTZ DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu RECORD;
BEGIN
  -- Get the menu
  SELECT * INTO v_menu FROM disposable_menus WHERE id = p_menu_id;

  IF v_menu IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Menu not found');
  END IF;

  IF v_menu.status NOT IN ('archived', 'soft_burned', 'hard_burned') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Menu is not archived');
  END IF;

  -- Update the menu to active status
  UPDATE disposable_menus
  SET
    status = 'active',
    archived_at = NULL,
    archived_reason = NULL,
    is_scheduled = (p_new_activation_time IS NOT NULL OR p_new_deactivation_time IS NOT NULL),
    scheduled_activation_time = p_new_activation_time,
    scheduled_deactivation_time = p_new_deactivation_time,
    schedule_timezone = p_timezone
  WHERE id = p_menu_id;

  -- Log the reactivation
  INSERT INTO menu_schedule_history (
    menu_id,
    tenant_id,
    action,
    previous_status,
    new_status,
    scheduled_activation_time,
    scheduled_deactivation_time,
    metadata
  ) VALUES (
    p_menu_id,
    v_menu.tenant_id,
    'activated',
    v_menu.status,
    'active',
    p_new_activation_time,
    p_new_deactivation_time,
    jsonb_build_object(
      'reactivated', true,
      'previousAnalytics', v_menu.analytics_snapshot
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'menuId', p_menu_id,
    'status', 'active'
  );
END;
$$;

-- Enhanced process_scheduled_menus to archive instead of soft_burn for non-recurring menus
CREATE OR REPLACE FUNCTION public.process_scheduled_menus()
RETURNS TABLE (
  menu_id UUID,
  action TEXT,
  menu_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_menu RECORD;
  v_archive_result JSONB;
BEGIN
  -- Activate menus that are scheduled and past activation time
  FOR v_menu IN
    SELECT dm.id, dm.name, dm.tenant_id, dm.status
    FROM disposable_menus dm
    WHERE dm.is_scheduled = true
      AND dm.status != 'active'
      AND dm.status != 'archived'
      AND dm.scheduled_activation_time IS NOT NULL
      AND dm.scheduled_activation_time <= v_now
      AND (dm.scheduled_deactivation_time IS NULL OR dm.scheduled_deactivation_time > v_now)
  LOOP
    -- Update menu status to active
    UPDATE disposable_menus
    SET status = 'active'
    WHERE id = v_menu.id;

    -- Log the activation
    INSERT INTO menu_schedule_history (
      menu_id, tenant_id, action,
      scheduled_activation_time, previous_status, new_status
    ) VALUES (
      v_menu.id, v_menu.tenant_id, 'activated',
      v_now, v_menu.status::text, 'active'
    );

    menu_id := v_menu.id;
    action := 'activated';
    menu_name := v_menu.name;
    RETURN NEXT;
  END LOOP;

  -- Archive or deactivate menus that are past deactivation time
  FOR v_menu IN
    SELECT dm.id, dm.name, dm.tenant_id, dm.status, dm.recurrence_pattern, dm.recurrence_config
    FROM disposable_menus dm
    WHERE dm.is_scheduled = true
      AND dm.status = 'active'
      AND dm.scheduled_deactivation_time IS NOT NULL
      AND dm.scheduled_deactivation_time <= v_now
  LOOP
    -- Handle recurrence - schedule next occurrence
    IF v_menu.recurrence_pattern IS NOT NULL AND v_menu.recurrence_pattern != 'none' THEN
      -- For recurring menus, just reschedule
      PERFORM reschedule_recurring_menu(v_menu.id, v_menu.recurrence_pattern);

      menu_id := v_menu.id;
      action := 'rescheduled';
      menu_name := v_menu.name;
    ELSE
      -- For non-recurring menus, archive with analytics preserved
      v_archive_result := archive_menu_with_analytics(v_menu.id, 'schedule_ended');

      menu_id := v_menu.id;
      action := 'archived';
      menu_name := v_menu.name;
    END IF;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.archive_menu_with_analytics(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_archived_menu(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- Comments
COMMENT ON COLUMN public.disposable_menus.archived_at IS 'When the menu was archived (preserves analytics)';
COMMENT ON COLUMN public.disposable_menus.archived_reason IS 'Why the menu was archived: expired, manual, schedule_ended';
COMMENT ON COLUMN public.disposable_menus.analytics_snapshot IS 'Preserved analytics at time of archival: views, orders, revenue, conversion rate';
COMMENT ON FUNCTION public.archive_menu_with_analytics IS 'Archives a menu and preserves its analytics snapshot';
COMMENT ON FUNCTION public.reactivate_archived_menu IS 'Reactivates an archived menu with optional new schedule';
