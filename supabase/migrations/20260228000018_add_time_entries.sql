-- Migration: Create time_entries table for employee clock-in/clock-out tracking
-- Epic: floraiq-7r6 - Time & Attendance

-- Create time_entries table
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  location_lat DECIMAL,
  location_lng DECIMAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'approved')),
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON public.time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON public.time_entries(clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_user ON public.time_entries(tenant_id, user_id);

-- Enable Row Level Security
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own time entries within their tenant
CREATE POLICY "Users can view own time entries"
  ON public.time_entries
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = time_entries.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'owner')
      )
    )
  );

-- RLS Policy: Users can insert their own time entries
CREATE POLICY "Users can insert own time entries"
  ON public.time_entries
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own active entries; admins can update any in their tenant
CREATE POLICY "Users can update own time entries"
  ON public.time_entries
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = time_entries.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('admin', 'owner')
      )
    )
  );

-- RLS Policy: Only admins can delete time entries in their tenant
CREATE POLICY "Admins can delete time entries"
  ON public.time_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = time_entries.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('admin', 'owner')
    )
  );

-- Add comments
COMMENT ON TABLE public.time_entries IS 'Employee time tracking entries for clock-in/clock-out';
COMMENT ON COLUMN public.time_entries.status IS 'Entry status: active (clocked in), completed (clocked out), approved (reviewed by manager)';
COMMENT ON COLUMN public.time_entries.break_minutes IS 'Total break time in minutes during the shift';
COMMENT ON COLUMN public.time_entries.approved_by IS 'User ID of the manager who approved this entry';
