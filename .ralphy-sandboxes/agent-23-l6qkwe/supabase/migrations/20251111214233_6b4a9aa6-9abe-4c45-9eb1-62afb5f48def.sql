-- PHASE 6: Add missing search_path to database functions for security
-- This prevents search_path manipulation attacks

-- Fix functions missing search_path declarations
CREATE OR REPLACE FUNCTION public.generate_wholesale_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN 'WO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_wholesale_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_wholesale_order_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_client_reliability(p_client_id uuid, p_payment_made boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_payment_made THEN
    UPDATE public.wholesale_clients
    SET reliability_score = LEAST(100, reliability_score + 5)
    WHERE id = p_client_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tenants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_delivery_schedule_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.scheduled_delivery_time IS DISTINCT FROM OLD.scheduled_delivery_time THEN
    NEW.delivery_scheduled_at := NEW.scheduled_delivery_time;
  END IF;
  IF NEW.delivery_scheduled_at IS DISTINCT FROM OLD.delivery_scheduled_at THEN
    NEW.scheduled_delivery_time := NEW.delivery_scheduled_at;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_pos_transaction_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_shift_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN 'SH-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_pos_transaction_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.transaction_number IS NULL THEN
    NEW.transaction_number := generate_pos_transaction_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_shift_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.shift_number IS NULL THEN
    NEW.shift_number := generate_shift_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_wholesale_inventory(p_product_name text, p_quantity_lbs numeric, p_quantity_units integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_lbs NUMERIC;
  current_units INTEGER;
BEGIN
  SELECT quantity_lbs, quantity_units INTO current_lbs, current_units
  FROM public.wholesale_inventory
  WHERE product_name = p_product_name
  FOR UPDATE;
  
  IF current_lbs IS NULL OR current_lbs < p_quantity_lbs OR current_units < p_quantity_units THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.wholesale_inventory
  SET 
    quantity_lbs = quantity_lbs - p_quantity_lbs,
    quantity_units = quantity_units - p_quantity_units,
    updated_at = NOW()
  WHERE product_name = p_product_name;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_whitelist_on_first_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.first_access_at IS NOT NULL AND OLD.first_access_at IS NULL THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_menu_view_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  period_start_date date;
  period_end_date date;
BEGIN
  IF NEW.action = 'viewed' THEN
    period_start_date := date_trunc('week', NEW.accessed_at)::date;
    period_end_date := (period_start_date + interval '7 days')::date;
    
    INSERT INTO menu_view_tracking (
      menu_id,
      customer_id,
      whitelist_entry_id,
      period_start,
      period_end,
      view_count,
      last_view_at
    ) VALUES (
      NEW.menu_id,
      NEW.customer_id,
      NEW.whitelist_entry_id,
      period_start_date,
      period_end_date,
      1,
      NEW.accessed_at
    )
    ON CONFLICT (menu_id, customer_id, period_start)
    DO UPDATE SET
      view_count = menu_view_tracking.view_count + 1,
      last_view_at = NEW.accessed_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_shift_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.shift_id IS NOT NULL AND NEW.payment_status = 'completed' THEN
    UPDATE public.pos_shifts
    SET 
      total_sales = total_sales + NEW.total_amount,
      total_transactions = total_transactions + 1,
      cash_sales = CASE WHEN NEW.payment_method = 'cash' THEN cash_sales + NEW.total_amount ELSE cash_sales END,
      card_sales = CASE WHEN NEW.payment_method = 'card' THEN card_sales + NEW.total_amount ELSE card_sales END,
      other_sales = CASE WHEN NEW.payment_method NOT IN ('cash', 'card') THEN other_sales + NEW.total_amount ELSE other_sales END,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_pos_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status != 'refunded' THEN
    UPDATE public.pos_shifts
    SET 
      refunds_amount = refunds_amount + NEW.total_amount,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_inventory_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.quantity_lbs = 0 OR NEW.quantity_units = 0 THEN
    INSERT INTO inventory_alerts (product_id, product_name, alert_type, severity, current_quantity, reorder_point, message)
    VALUES (
      NEW.id,
      NEW.product_name,
      'out_of_stock',
      'critical',
      NEW.quantity_lbs,
      NEW.reorder_point,
      format('%s is out of stock! Immediate action required.', NEW.product_name)
    )
    ON CONFLICT DO NOTHING;
  
  ELSIF NEW.quantity_lbs <= NEW.reorder_point AND NEW.reorder_point > 0 THEN
    INSERT INTO inventory_alerts (product_id, product_name, alert_type, severity, current_quantity, reorder_point, message)
    VALUES (
      NEW.id,
      NEW.product_name,
      'reorder_needed',
      'warning',
      NEW.quantity_lbs,
      NEW.reorder_point,
      format('%s is below reorder point (%s lbs). Current: %s lbs', NEW.product_name, NEW.reorder_point, NEW.quantity_lbs)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_inventory_alert(alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE inventory_alerts
  SET is_resolved = true, resolved_at = now()
  WHERE id = alert_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_giveaway_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE giveaways
  SET 
    total_entries = (
      SELECT COALESCE(SUM(total_entries), 0) 
      FROM giveaway_entries 
      WHERE giveaway_id = NEW.giveaway_id
    ),
    total_participants = (
      SELECT COUNT(DISTINCT user_id)
      FROM giveaway_entries
      WHERE giveaway_id = NEW.giveaway_id
    ),
    updated_at = NOW()
  WHERE id = NEW.giveaway_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.user_id::TEXT) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE coupon_codes
  SET used_count = used_count + 1
  WHERE id = coupon_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_admin_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  pin TEXT;
BEGIN
  pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  RETURN pin;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.tracking_code IS NULL THEN
    LOOP
      new_code := generate_tracking_code();
      SELECT EXISTS(SELECT 1 FROM orders WHERE tracking_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.tracking_code := new_code;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status automatically updated');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_accepted_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.courier_id IS NOT NULL AND (OLD.courier_id IS NULL OR OLD.courier_id != NEW.courier_id) THEN
    NEW.accepted_at := NOW();
    NEW.courier_accepted_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_recent_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    INSERT INTO recent_purchases (product_id, customer_name, location)
    SELECT 
      oi.product_id,
      COALESCE(
        (SELECT full_name FROM profiles WHERE user_id = NEW.user_id LIMIT 1),
        'Customer'
      ),
      NEW.delivery_borough
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    LIMIT 1;
    
    DELETE FROM recent_purchases
    WHERE id IN (
      SELECT id FROM recent_purchases
      ORDER BY created_at DESC
      OFFSET 50
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_risk_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.risk_score := calculate_risk_score(NEW.user_id);
  
  IF NEW.risk_score >= 80 THEN
    NEW.trust_level := 'vip';
  ELSIF NEW.risk_score >= 60 THEN
    NEW.trust_level := 'regular';
  ELSIF NEW.risk_score >= 40 THEN
    NEW.trust_level := 'new';
  ELSE
    NEW.trust_level := 'flagged';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_ip_address(_user_id uuid, _ip_address text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_ip_addresses (user_id, ip_address, times_used)
  VALUES (_user_id, _ip_address, 1)
  ON CONFLICT (user_id, ip_address)
  DO UPDATE SET
    last_seen = now(),
    times_used = user_ip_addresses.times_used + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_entry_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  entry_num TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    entry_num := 'GIVE-' || 
                 TO_CHAR(NOW(), 'YYMMDD') || '-' || 
                 UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    
    SELECT EXISTS(
      SELECT 1 FROM giveaway_entries WHERE entry_number_start::TEXT = entry_num
    ) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN entry_num;
END;
$function$;