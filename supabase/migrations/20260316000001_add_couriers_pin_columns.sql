-- Add pin_hash and pin_updated_at columns to couriers table
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.couriers.pin_hash IS 'PBKDF2-SHA256 hashed 6-digit PIN for order verification';
COMMENT ON COLUMN public.couriers.pin_updated_at IS 'Timestamp of last PIN change';
