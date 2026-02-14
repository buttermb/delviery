-- Add payment_status column to wholesale_orders table
ALTER TABLE public.wholesale_orders 
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial', 'overdue'));

-- Add index for filtering by payment status
CREATE INDEX idx_wholesale_orders_payment_status ON public.wholesale_orders(payment_status);

COMMENT ON COLUMN public.wholesale_orders.payment_status IS 'Payment status of the order: paid, unpaid, partial, overdue';
