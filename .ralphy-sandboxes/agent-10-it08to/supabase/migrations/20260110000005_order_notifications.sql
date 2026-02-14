-- Add notification tracking to marketplace orders
-- Supports "Order Ready" SMS/Email notifications

ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

-- Index for finding orders that need notification
CREATE INDEX IF NOT EXISTS idx_orders_notification_pending
ON public.marketplace_orders(status, notification_sent)
WHERE status = 'ready' AND notification_sent = false;

COMMENT ON COLUMN public.marketplace_orders.notification_sent IS 'Whether the "order ready" notification has been sent to customer';
COMMENT ON COLUMN public.marketplace_orders.notification_sent_at IS 'Timestamp when the notification was sent';
