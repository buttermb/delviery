-- Add suspension and termination tracking columns to couriers
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.couriers.suspended_at IS 'When the driver was suspended';
COMMENT ON COLUMN public.couriers.suspended_until IS 'When the suspension expires (null = indefinite)';
COMMENT ON COLUMN public.couriers.suspension_reason IS 'Admin-provided reason for suspension';
COMMENT ON COLUMN public.couriers.terminated_at IS 'When the driver was permanently terminated';
