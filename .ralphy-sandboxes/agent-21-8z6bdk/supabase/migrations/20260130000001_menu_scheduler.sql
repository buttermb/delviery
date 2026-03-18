-- ============================================================================
-- MENU SCHEDULER - Time-based menu activation
-- ============================================================================
-- Adds scheduling columns to disposable_menus for automatic activation/deactivation
-- ============================================================================

-- Add scheduling columns to disposable_menus
ALTER TABLE public.disposable_menus
ADD COLUMN IF NOT EXISTS scheduled_activation_time TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scheduled_deactivation_time TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS schedule_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT DEFAULT NULL CHECK (
  recurrence_pattern IS NULL OR recurrence_pattern IN ('none', 'daily', 'weekly', 'monthly')
),
ADD COLUMN IF NOT EXISTS recurrence_config JSONB DEFAULT '{}';

-- Add index for scheduled menus lookup
CREATE INDEX IF NOT EXISTS idx_disposable_menus_scheduled
ON public.disposable_menus(is_scheduled, scheduled_activation_time, scheduled_deactivation_time)
WHERE is_scheduled = true;

-- Create menu schedule history table for audit trail
CREATE TABLE IF NOT EXISTS public.menu_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('scheduled', 'activated', 'deactivated', 'schedule_updated', 'schedule_cancelled')),
  scheduled_activation_time TIMESTAMPTZ,
  scheduled_deactivation_time TIMESTAMPTZ,
  previous_status TEXT,
  new_status TEXT,
  recurrence_pattern TEXT,
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Add indexes for menu_schedule_history
CREATE INDEX IF NOT EXISTS idx_menu_schedule_history_menu_id
ON public.menu_schedule_history(menu_id);

CREATE INDEX IF NOT EXISTS idx_menu_schedule_history_tenant_id
ON public.menu_schedule_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_menu_schedule_history_executed_at
ON public.menu_schedule_history(executed_at DESC);

-- Enable RLS on menu_schedule_history
ALTER TABLE public.menu_schedule_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_schedule_history
CREATE POLICY "Users can view schedule history for their tenant menus"
ON public.menu_schedule_history FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create schedule history for their tenant menus"
ON public.menu_schedule_history FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
  )
);

-- Function to check and activate/deactivate scheduled menus
-- This can be called by a cron job or edge function
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
BEGIN
  -- Activate menus that are scheduled and past activation time
  FOR v_menu IN
    SELECT dm.id, dm.name, dm.tenant_id, dm.status
    FROM disposable_menus dm
    WHERE dm.is_scheduled = true
      AND dm.status != 'active'
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

  -- Deactivate menus that are past deactivation time
  FOR v_menu IN
    SELECT dm.id, dm.name, dm.tenant_id, dm.status, dm.recurrence_pattern, dm.recurrence_config
    FROM disposable_menus dm
    WHERE dm.is_scheduled = true
      AND dm.status = 'active'
      AND dm.scheduled_deactivation_time IS NOT NULL
      AND dm.scheduled_deactivation_time <= v_now
  LOOP
    -- Update menu status to soft_burned (deactivated)
    UPDATE disposable_menus
    SET status = 'soft_burned'
    WHERE id = v_menu.id;

    -- Log the deactivation
    INSERT INTO menu_schedule_history (
      menu_id, tenant_id, action,
      scheduled_deactivation_time, previous_status, new_status
    ) VALUES (
      v_menu.id, v_menu.tenant_id, 'deactivated',
      v_now, 'active', 'soft_burned'
    );

    -- Handle recurrence - schedule next occurrence
    IF v_menu.recurrence_pattern IS NOT NULL AND v_menu.recurrence_pattern != 'none' THEN
      PERFORM reschedule_recurring_menu(v_menu.id, v_menu.recurrence_pattern);
    ELSE
      -- Clear scheduling for non-recurring menus
      UPDATE disposable_menus
      SET is_scheduled = false,
          scheduled_activation_time = NULL,
          scheduled_deactivation_time = NULL
      WHERE id = v_menu.id;
    END IF;

    menu_id := v_menu.id;
    action := 'deactivated';
    menu_name := v_menu.name;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- Function to reschedule recurring menus
CREATE OR REPLACE FUNCTION public.reschedule_recurring_menu(
  p_menu_id UUID,
  p_pattern TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu RECORD;
  v_interval INTERVAL;
BEGIN
  SELECT * INTO v_menu FROM disposable_menus WHERE id = p_menu_id;

  IF v_menu IS NULL THEN
    RETURN;
  END IF;

  -- Determine interval based on pattern
  CASE p_pattern
    WHEN 'daily' THEN v_interval := INTERVAL '1 day';
    WHEN 'weekly' THEN v_interval := INTERVAL '7 days';
    WHEN 'monthly' THEN v_interval := INTERVAL '1 month';
    ELSE RETURN; -- No recurrence
  END CASE;

  -- Update to next occurrence
  UPDATE disposable_menus
  SET
    scheduled_activation_time = scheduled_activation_time + v_interval,
    scheduled_deactivation_time = scheduled_deactivation_time + v_interval,
    status = 'soft_burned' -- Keep deactivated until next activation
  WHERE id = p_menu_id;

  -- Log the reschedule
  INSERT INTO menu_schedule_history (
    menu_id, tenant_id, action,
    scheduled_activation_time, scheduled_deactivation_time,
    recurrence_pattern, metadata
  ) VALUES (
    p_menu_id, v_menu.tenant_id, 'schedule_updated',
    v_menu.scheduled_activation_time + v_interval,
    v_menu.scheduled_deactivation_time + v_interval,
    p_pattern,
    jsonb_build_object('reason', 'auto_rescheduled', 'previous_activation', v_menu.scheduled_activation_time)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_scheduled_menus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_recurring_menu(UUID, TEXT) TO authenticated;

-- Comment on new columns
COMMENT ON COLUMN public.disposable_menus.scheduled_activation_time IS 'When the menu should automatically become active';
COMMENT ON COLUMN public.disposable_menus.scheduled_deactivation_time IS 'When the menu should automatically become inactive';
COMMENT ON COLUMN public.disposable_menus.is_scheduled IS 'Whether this menu has scheduling enabled';
COMMENT ON COLUMN public.disposable_menus.schedule_timezone IS 'Timezone for schedule display (actual times stored in UTC)';
COMMENT ON COLUMN public.disposable_menus.recurrence_pattern IS 'Recurrence pattern: none, daily, weekly, monthly';
COMMENT ON COLUMN public.disposable_menus.recurrence_config IS 'Additional recurrence configuration (e.g., specific days)';
