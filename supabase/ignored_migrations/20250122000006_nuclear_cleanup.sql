-- Nuclear Option Phase 3: Cleanup & Maintenance
-- Automated cleanup for expired reservations

-- 1. Cleanup Function (to be called by pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_item JSONB;
  v_count INTEGER := 0;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  -- Loop through expired pending reservations
  -- Use FOR UPDATE SKIP LOCKED to allow concurrent cleanups if needed
  FOR v_reservation IN
    SELECT * FROM public.inventory_reservations
    WHERE status = 'pending' AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Restore inventory for each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_reservation.items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;

      UPDATE public.wholesale_inventory
      SET quantity_lbs = quantity_lbs + v_quantity,
          updated_at = NOW()
      WHERE id = v_product_id;
    END LOOP;

    -- Mark as expired
    UPDATE public.inventory_reservations
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_reservation.id;

    -- Log compliance event
    INSERT INTO public.compliance_logs (
      event_type,
      entity_type,
      entity_id,
      data_snapshot
    ) VALUES (
      'reservation_expired',
      'inventory_reservation',
      v_reservation.id,
      jsonb_build_object('reason', 'auto_cleanup_job')
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

-- 2. Optional: Trigger to prevent negative inventory (Safety Net)
-- The Nuclear Option relies on pessimistic locking, but a constraint is a good final guardrail.
ALTER TABLE public.wholesale_inventory 
DROP CONSTRAINT IF EXISTS quantity_non_negative;

ALTER TABLE public.wholesale_inventory 
ADD CONSTRAINT quantity_non_negative CHECK (quantity_lbs >= 0);
