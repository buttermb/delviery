-- ============================================================================
-- Comprehensive Order Sync Triggers
-- Syncs menu_orders, wholesale_orders, and pos_transactions to unified_orders
-- ============================================================================

-- 1. SYNC MENU ORDERS TO UNIFIED ORDERS
CREATE OR REPLACE FUNCTION public.sync_menu_order_to_unified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO unified_orders (
    id, tenant_id, order_number, order_type, source, status,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, menu_id, contact_name, contact_phone,
    delivery_address, metadata, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    COALESCE(NEW.order_number, 'MO-' || SUBSTR(NEW.id::text, 1, 8)),
    'menu',
    'disposable_menu',
    COALESCE(NEW.status::text, 'pending'),
    COALESCE(NEW.total_amount, 0),
    0,
    0,
    COALESCE(NEW.total_amount, 0),
    NEW.payment_method,
    COALESCE(NEW.payment_status, 'pending'),
    NEW.menu_id,
    NEW.customer_name,
    NEW.contact_phone,
    NEW.delivery_address,
    NEW.order_data,
    NEW.created_at,
    COALESCE(NEW.processed_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_order_sync_trigger ON menu_orders;
CREATE TRIGGER menu_order_sync_trigger
AFTER INSERT OR UPDATE ON menu_orders
FOR EACH ROW EXECUTE FUNCTION sync_menu_order_to_unified();

-- 2. SYNC WHOLESALE ORDERS TO UNIFIED ORDERS
CREATE OR REPLACE FUNCTION public.sync_wholesale_order_to_unified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  -- Get client name
  SELECT business_name INTO v_client_name
  FROM wholesale_clients
  WHERE id = NEW.client_id;

  INSERT INTO unified_orders (
    id, tenant_id, order_number, order_type, source, status,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, wholesale_client_id, contact_name, 
    delivery_address, delivery_notes, metadata, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    COALESCE(NEW.order_number, 'WO-' || SUBSTR(NEW.id::text, 1, 8)),
    'wholesale',
    'wholesale',
    COALESCE(NEW.status, 'pending'),
    COALESCE(NEW.total_amount, 0),
    0,
    COALESCE(NEW.discount_amount, 0),
    COALESCE(NEW.total_amount, 0),
    NEW.payment_method,
    COALESCE(NEW.payment_status, 'pending'),
    NEW.client_id,
    v_client_name,
    NEW.delivery_address,
    NEW.delivery_notes,
    jsonb_build_object('source_table', 'wholesale_orders'),
    NEW.created_at,
    COALESCE(NEW.updated_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wholesale_order_sync_trigger ON wholesale_orders;
CREATE TRIGGER wholesale_order_sync_trigger
AFTER INSERT OR UPDATE ON wholesale_orders
FOR EACH ROW EXECUTE FUNCTION sync_wholesale_order_to_unified();

-- 3. SYNC POS TRANSACTIONS TO UNIFIED ORDERS
CREATE OR REPLACE FUNCTION public.sync_pos_transaction_to_unified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
BEGIN
  -- Get customer name if exists
  IF NEW.customer_id IS NOT NULL THEN
    SELECT CONCAT(first_name, ' ', last_name) INTO v_customer_name
    FROM customers
    WHERE id = NEW.customer_id;
  END IF;

  INSERT INTO unified_orders (
    id, tenant_id, order_number, order_type, source, status,
    subtotal, tax_amount, discount_amount, total_amount,
    payment_method, payment_status, customer_id, shift_id, contact_name,
    metadata, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    COALESCE(NEW.transaction_number, 'POS-' || SUBSTR(NEW.id::text, 1, 8)),
    'pos',
    'pos',
    CASE WHEN NEW.payment_status = 'completed' THEN 'completed' ELSE 'pending' END,
    COALESCE(NEW.subtotal, NEW.total_amount),
    COALESCE(NEW.tax_amount, 0),
    COALESCE(NEW.discount_amount, 0),
    COALESCE(NEW.total_amount, 0),
    NEW.payment_method,
    COALESCE(NEW.payment_status, 'pending'),
    NEW.customer_id,
    NEW.shift_id,
    v_customer_name,
    jsonb_build_object('source_table', 'pos_transactions', 'register_id', NEW.register_id),
    NEW.created_at,
    COALESCE(NEW.updated_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    payment_status = EXCLUDED.payment_status,
    total_amount = EXCLUDED.total_amount,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pos_transaction_sync_trigger ON pos_transactions;
CREATE TRIGGER pos_transaction_sync_trigger
AFTER INSERT OR UPDATE ON pos_transactions
FOR EACH ROW EXECUTE FUNCTION sync_pos_transaction_to_unified();