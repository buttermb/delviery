-- Step 1: Add missing columns to marketplace_orders table
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS tracking_token TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.marketplace_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Create index on tracking_token
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_tracking_token ON public.marketplace_orders(tracking_token);