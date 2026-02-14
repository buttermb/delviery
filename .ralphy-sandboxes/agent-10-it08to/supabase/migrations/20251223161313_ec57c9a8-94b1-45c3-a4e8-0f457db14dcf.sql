-- Add stripe_event_id column for webhook idempotency
-- This prevents duplicate webhook processing

-- Add stripe_event_id column to subscription_events table
ALTER TABLE public.subscription_events 
ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Create unique index for idempotency (allows NULL values but enforces uniqueness on non-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_stripe_event_id 
ON public.subscription_events(stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.subscription_events.stripe_event_id IS 'Stripe event ID for webhook idempotency - prevents duplicate processing';