-- Atomic idempotency table for Stripe webhook deduplication.
-- The stripe-webhook edge function inserts into this table BEFORE processing.
-- A unique constraint on stripe_event_id prevents TOCTOU race conditions.

CREATE TABLE IF NOT EXISTS public.webhook_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_idempotency_stripe_event_id_key UNIQUE (stripe_event_id)
);

-- Index for fast lookups (the unique constraint already creates one, but be explicit)
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_created_at
  ON public.webhook_idempotency (created_at);

-- Allow the service role to insert; no RLS needed (only edge functions use this table)
ALTER TABLE public.webhook_idempotency ENABLE ROW LEVEL SECURITY;
