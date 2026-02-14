-- ============================================================================
-- MENU SCHEDULES TABLE
-- ============================================================================
-- Create menu_schedules table for flexible scheduling of disposable menus
-- Supports multiple schedules per menu, recurring schedules, and auto-activation
-- ============================================================================

-- Create menu_schedules table
CREATE TABLE IF NOT EXISTS public.menu_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT, -- cron-like recurrence pattern (e.g., "FREQ=WEEKLY;BYDAY=FR,SA,SU")
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_schedules_tenant_id
ON public.menu_schedules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_menu_schedules_menu_id
ON public.menu_schedules(menu_id);

CREATE INDEX IF NOT EXISTS idx_menu_schedules_start_time
ON public.menu_schedules(start_time);

CREATE INDEX IF NOT EXISTS idx_menu_schedules_is_active
ON public.menu_schedules(is_active)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_menu_schedules_active_range
ON public.menu_schedules(tenant_id, start_time, end_time)
WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE public.menu_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view schedules for their tenant
CREATE POLICY "Users can view menu schedules for their tenant"
ON public.menu_schedules
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

-- RLS Policy: Users can insert schedules for their tenant
CREATE POLICY "Users can insert menu schedules for their tenant"
ON public.menu_schedules
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

-- RLS Policy: Users can update schedules for their tenant
CREATE POLICY "Users can update menu schedules for their tenant"
ON public.menu_schedules
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

-- RLS Policy: Users can delete schedules for their tenant
CREATE POLICY "Users can delete menu schedules for their tenant"
ON public.menu_schedules
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_menu_schedules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS menu_schedules_updated_at ON public.menu_schedules;
CREATE TRIGGER menu_schedules_updated_at
  BEFORE UPDATE ON public.menu_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_menu_schedules_updated_at();

-- Function to process menu schedules and auto-activate/deactivate menus
CREATE OR REPLACE FUNCTION public.process_menu_schedules()
RETURNS TABLE (
  schedule_id UUID,
  menu_id UUID,
  menu_name TEXT,
  action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_schedule RECORD;
BEGIN
  -- Find schedules that should activate menus
  FOR v_schedule IN
    SELECT
      ms.id AS schedule_id,
      ms.menu_id,
      ms.tenant_id,
      ms.start_time,
      ms.end_time,
      dm.name AS menu_name,
      dm.status AS current_status
    FROM menu_schedules ms
    JOIN disposable_menus dm ON dm.id = ms.menu_id
    WHERE ms.is_active = TRUE
      AND ms.start_time <= v_now
      AND (ms.end_time IS NULL OR ms.end_time > v_now)
      AND dm.status != 'active'
  LOOP
    -- Activate the menu
    UPDATE disposable_menus
    SET status = 'active'
    WHERE id = v_schedule.menu_id;

    schedule_id := v_schedule.schedule_id;
    menu_id := v_schedule.menu_id;
    menu_name := v_schedule.menu_name;
    action := 'activated';
    RETURN NEXT;
  END LOOP;

  -- Find schedules that should deactivate menus
  FOR v_schedule IN
    SELECT
      ms.id AS schedule_id,
      ms.menu_id,
      ms.tenant_id,
      ms.end_time,
      dm.name AS menu_name,
      dm.status AS current_status
    FROM menu_schedules ms
    JOIN disposable_menus dm ON dm.id = ms.menu_id
    WHERE ms.is_active = TRUE
      AND ms.end_time IS NOT NULL
      AND ms.end_time <= v_now
      AND dm.status = 'active'
  LOOP
    -- Deactivate the menu
    UPDATE disposable_menus
    SET status = 'soft_burned'
    WHERE id = v_schedule.menu_id;

    -- Mark schedule as inactive if not recurring
    IF NOT EXISTS (
      SELECT 1 FROM menu_schedules
      WHERE id = v_schedule.schedule_id
      AND is_recurring = TRUE
    ) THEN
      UPDATE menu_schedules
      SET is_active = FALSE
      WHERE id = v_schedule.schedule_id;
    END IF;

    schedule_id := v_schedule.schedule_id;
    menu_id := v_schedule.menu_id;
    menu_name := v_schedule.menu_name;
    action := 'deactivated';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_menu_schedules() TO authenticated;

-- Comments
COMMENT ON TABLE public.menu_schedules IS 'Stores scheduling information for disposable menus including start/end times and recurrence rules';
COMMENT ON COLUMN public.menu_schedules.tenant_id IS 'Tenant that owns this schedule';
COMMENT ON COLUMN public.menu_schedules.menu_id IS 'The disposable menu this schedule applies to';
COMMENT ON COLUMN public.menu_schedules.start_time IS 'When the menu should be activated';
COMMENT ON COLUMN public.menu_schedules.end_time IS 'When the menu should be deactivated (NULL for indefinite)';
COMMENT ON COLUMN public.menu_schedules.is_recurring IS 'Whether this schedule repeats';
COMMENT ON COLUMN public.menu_schedules.recurrence_rule IS 'iCal-style recurrence rule (e.g., FREQ=WEEKLY;BYDAY=FR,SA,SU)';
COMMENT ON COLUMN public.menu_schedules.is_active IS 'Whether this schedule is currently active';
