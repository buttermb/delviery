-- Add tracking columns
ALTER TABLE public.menu_orders 
ADD COLUMN IF NOT EXISTS synced_order_id UUID REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS synced_invoice_id UUID REFERENCES public.crm_invoices(id);

-- Create sync function
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_systems()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_invoice_id UUID;
  v_client_id UUID;
  v_account_id UUID;
  v_tenant_id UUID;
BEGIN
  IF NEW.synced_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := COALESCE(NEW.tenant_id, (SELECT tenant_id FROM public.disposable_menus WHERE id = NEW.menu_id));
  v_order_id := gen_random_uuid();
  
  INSERT INTO public.orders (
    id, tenant_id, user_id, order_number, status, subtotal, total_amount,
    delivery_address, delivery_borough, delivery_fee, payment_method,
    delivery_notes, customer_name, customer_phone, created_at
  ) VALUES (
    v_order_id, v_tenant_id, NULL,
    'MO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
    NEW.status, NEW.total_amount, NEW.total_amount,
    COALESCE(NEW.delivery_address, 'N/A'), 'Manhattan', 0,
    COALESCE(NEW.payment_method, 'cash'), NEW.customer_notes,
    COALESCE((NEW.order_data->>'customer_name')::text, 'Menu Customer'),
    NEW.contact_phone, NEW.created_at
  );

  NEW.synced_order_id := v_order_id;

  IF NEW.access_whitelist_id IS NOT NULL THEN
    SELECT customer_id INTO v_client_id FROM public.menu_access_whitelist WHERE id = NEW.access_whitelist_id;
    
    IF v_client_id IS NOT NULL THEN
      SELECT id INTO v_account_id FROM public.accounts WHERE tenant_id = v_tenant_id LIMIT 1;
      
      IF v_account_id IS NOT NULL THEN
        INSERT INTO public.crm_invoices (
          account_id, client_id, invoice_number, invoice_date, due_date,
          line_items, subtotal, total, status, created_at
        ) VALUES (
          v_account_id, v_client_id,
          'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM public.crm_invoices WHERE account_id = v_account_id)::TEXT, 4, '0'),
          CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
          NEW.order_data->'items', NEW.total_amount, NEW.total_amount, 'sent', NEW.created_at
        ) RETURNING id INTO v_invoice_id;
        
        NEW.synced_invoice_id := v_invoice_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_menu_order_created ON public.menu_orders;
CREATE TRIGGER on_menu_order_created
  BEFORE INSERT ON public.menu_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_menu_order_to_systems();