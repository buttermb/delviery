-- Add RPC function to increment runner deliveries
CREATE OR REPLACE FUNCTION public.increment_runner_deliveries(p_runner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.wholesale_runners
  SET 
    total_deliveries = total_deliveries + 1,
    updated_at = NOW()
  WHERE id = p_runner_id;
END;
$$;

-- Create view for runner earnings
CREATE OR REPLACE VIEW public.runner_earnings_view AS
SELECT 
  wd.runner_id,
  wd.id as delivery_id,
  wd.order_id,
  wo.order_number,
  wd.status,
  wd.delivered_at as created_at,
  wo.total_amount as order_total,
  5.00 as delivery_fee,
  CASE 
    WHEN wd.status = 'delivered' THEN 5.00
    ELSE 0
  END as total_earned,
  wc.business_name as client_name,
  wo.delivery_address
FROM public.wholesale_deliveries wd
JOIN public.wholesale_orders wo ON wd.order_id = wo.id
JOIN public.wholesale_clients wc ON wo.client_id = wc.id
WHERE wd.status IN ('delivered', 'failed');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wholesale_deliveries_runner_status 
  ON public.wholesale_deliveries(runner_id, status);

CREATE INDEX IF NOT EXISTS idx_wholesale_deliveries_delivered_at 
  ON public.wholesale_deliveries(delivered_at) 
  WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_runner_location_history_runner_time 
  ON public.runner_location_history(runner_id, recorded_at DESC);

-- Enable realtime for wholesale deliveries
ALTER PUBLICATION supabase_realtime ADD TABLE public.wholesale_deliveries;