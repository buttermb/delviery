-- ============================================================================
-- ORDER AUDIT LOG TABLE
-- Tracks all changes made to orders with user attribution
-- Supports both regular orders and unified_orders tables
-- ============================================================================

-- Create order_audit_log table
CREATE TABLE IF NOT EXISTS public.order_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Order reference (supports both tables)
  order_id uuid NOT NULL,
  order_table text NOT NULL DEFAULT 'orders' CHECK (order_table IN ('orders', 'unified_orders', 'marketplace_orders', 'wholesale_orders')),
  order_number text,

  -- Change details
  action text NOT NULL CHECK (action IN (
    'created',
    'status_changed',
    'payment_updated',
    'shipping_updated',
    'items_modified',
    'notes_updated',
    'assigned_courier',
    'cancelled',
    'refunded',
    'delivered',
    'field_updated'
  )),

  -- What changed
  field_name text,
  old_value text,
  new_value text,

  -- Snapshot of changes (for complex updates)
  changes jsonb DEFAULT '{}',

  -- Who made the change
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_name text,
  actor_type text DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'webhook', 'api', 'customer')),

  -- Context
  ip_address inet,
  user_agent text,
  source text DEFAULT 'admin' CHECK (source IN ('admin', 'storefront', 'pos', 'api', 'webhook', 'system', 'customer_portal')),

  -- Notes
  reason text,
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "order_audit_log_tenant_read" ON public.order_audit_log
FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "order_audit_log_insert" ON public.order_audit_log
FOR INSERT WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  OR actor_type = 'system'
);

-- Performance indexes
CREATE INDEX idx_order_audit_log_tenant_order ON public.order_audit_log(tenant_id, order_id, created_at DESC);
CREATE INDEX idx_order_audit_log_order_id ON public.order_audit_log(order_id, created_at DESC);
CREATE INDEX idx_order_audit_log_actor ON public.order_audit_log(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_order_audit_log_action ON public.order_audit_log(tenant_id, action, created_at DESC);
CREATE INDEX idx_order_audit_log_created ON public.order_audit_log(created_at DESC);

-- ============================================================================
-- HELPER FUNCTION: Log order audit event
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_order_audit(
  p_tenant_id uuid,
  p_order_id uuid,
  p_order_table text DEFAULT 'orders',
  p_order_number text DEFAULT NULL,
  p_action text DEFAULT 'field_updated',
  p_field_name text DEFAULT NULL,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_changes jsonb DEFAULT '{}',
  p_actor_id uuid DEFAULT NULL,
  p_actor_email text DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_type text DEFAULT 'user',
  p_source text DEFAULT 'admin',
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id uuid;
  v_actor_email text;
  v_actor_name text;
BEGIN
  -- Try to get actor info from profiles if not provided
  IF p_actor_id IS NOT NULL AND (p_actor_email IS NULL OR p_actor_name IS NULL) THEN
    SELECT
      COALESCE(p_actor_email, email),
      COALESCE(p_actor_name, COALESCE(full_name, first_name || ' ' || last_name))
    INTO v_actor_email, v_actor_name
    FROM profiles
    WHERE user_id = p_actor_id;
  ELSE
    v_actor_email := p_actor_email;
    v_actor_name := p_actor_name;
  END IF;

  INSERT INTO order_audit_log (
    tenant_id,
    order_id,
    order_table,
    order_number,
    action,
    field_name,
    old_value,
    new_value,
    changes,
    actor_id,
    actor_email,
    actor_name,
    actor_type,
    source,
    reason,
    notes
  ) VALUES (
    p_tenant_id,
    p_order_id,
    p_order_table,
    p_order_number,
    p_action,
    p_field_name,
    p_old_value,
    p_new_value,
    p_changes,
    COALESCE(p_actor_id, auth.uid()),
    v_actor_email,
    v_actor_name,
    p_actor_type,
    p_source,
    p_reason,
    p_notes
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_order_audit TO authenticated;

-- ============================================================================
-- TRIGGER FUNCTION: Auto-log order changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_order_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}';
  v_action text := 'field_updated';
  v_field_name text;
  v_old_value text;
  v_new_value text;
BEGIN
  -- Determine the action based on operation
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_changes := to_jsonb(NEW);

    PERFORM log_order_audit(
      p_tenant_id := NEW.tenant_id,
      p_order_id := NEW.id,
      p_order_table := TG_TABLE_NAME,
      p_order_number := COALESCE(NEW.order_number, ''),
      p_action := v_action,
      p_changes := v_changes,
      p_actor_type := 'system',
      p_source := COALESCE(NEW.order_source, 'admin')
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_changed';
      IF NEW.status = 'cancelled' THEN
        v_action := 'cancelled';
      ELSIF NEW.status = 'delivered' THEN
        v_action := 'delivered';
      ELSIF NEW.status = 'refunded' THEN
        v_action := 'refunded';
      END IF;

      v_changes := v_changes || jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status)
      );
      v_field_name := 'status';
      v_old_value := OLD.status;
      v_new_value := NEW.status;

      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := v_action,
        p_field_name := v_field_name,
        p_old_value := v_old_value,
        p_new_value := v_new_value,
        p_changes := v_changes,
        p_actor_type := 'user',
        p_reason := CASE WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason ELSE NULL END
      );
    END IF;

    -- Track payment status changes
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := 'payment_updated',
        p_field_name := 'payment_status',
        p_old_value := COALESCE(OLD.payment_status, 'pending'),
        p_new_value := NEW.payment_status,
        p_changes := jsonb_build_object('payment_status', jsonb_build_object('old', OLD.payment_status, 'new', NEW.payment_status)),
        p_actor_type := 'user'
      );
    END IF;

    -- Track courier assignment
    IF OLD.courier_id IS DISTINCT FROM NEW.courier_id AND NEW.courier_id IS NOT NULL THEN
      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := 'assigned_courier',
        p_field_name := 'courier_id',
        p_old_value := OLD.courier_id::text,
        p_new_value := NEW.courier_id::text,
        p_actor_type := 'user'
      );
    END IF;

    -- Track shipping updates (tracking number)
    IF OLD.tracking_number IS DISTINCT FROM NEW.tracking_number AND NEW.tracking_number IS NOT NULL THEN
      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := 'shipping_updated',
        p_field_name := 'tracking_number',
        p_old_value := OLD.tracking_number,
        p_new_value := NEW.tracking_number,
        p_actor_type := 'user'
      );
    END IF;

    -- Track notes updates
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := 'notes_updated',
        p_field_name := 'notes',
        p_old_value := LEFT(OLD.notes, 500),
        p_new_value := LEFT(NEW.notes, 500),
        p_actor_type := 'user'
      );
    END IF;

    -- Track total amount changes (might indicate items modified)
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      PERFORM log_order_audit(
        p_tenant_id := NEW.tenant_id,
        p_order_id := NEW.id,
        p_order_table := TG_TABLE_NAME,
        p_order_number := COALESCE(NEW.order_number, ''),
        p_action := 'items_modified',
        p_field_name := 'total_amount',
        p_old_value := OLD.total_amount::text,
        p_new_value := NEW.total_amount::text,
        p_changes := jsonb_build_object('total_amount', jsonb_build_object('old', OLD.total_amount, 'new', NEW.total_amount)),
        p_actor_type := 'user'
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================================
-- CREATE TRIGGERS ON ORDER TABLES
-- ============================================================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS order_audit_trigger ON orders;
DROP TRIGGER IF EXISTS unified_order_audit_trigger ON unified_orders;
DROP TRIGGER IF EXISTS marketplace_order_audit_trigger ON marketplace_orders;

-- Create trigger on orders table
CREATE TRIGGER order_audit_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_audit_log();

-- Create trigger on unified_orders table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_orders') THEN
    EXECUTE 'CREATE TRIGGER unified_order_audit_trigger
      AFTER INSERT OR UPDATE ON unified_orders
      FOR EACH ROW
      EXECUTE FUNCTION trigger_order_audit_log()';
  END IF;
END $$;

-- Create trigger on marketplace_orders table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_orders') THEN
    EXECUTE 'CREATE TRIGGER marketplace_order_audit_trigger
      AFTER INSERT OR UPDATE ON marketplace_orders
      FOR EACH ROW
      EXECUTE FUNCTION trigger_order_audit_log()';
  END IF;
END $$;

-- ============================================================================
-- VIEW: Order audit log with order details
-- ============================================================================

CREATE OR REPLACE VIEW public.order_audit_log_detailed AS
SELECT
  oal.*,
  o.status as current_status,
  o.total_amount as current_total,
  p.full_name as actor_full_name
FROM order_audit_log oal
LEFT JOIN orders o ON oal.order_id = o.id AND oal.order_table = 'orders'
LEFT JOIN profiles p ON oal.actor_id = p.user_id;

COMMENT ON TABLE public.order_audit_log IS 'Tracks all changes made to orders with full user attribution';
COMMENT ON FUNCTION public.log_order_audit IS 'Helper function to log order audit events programmatically';
COMMENT ON FUNCTION public.trigger_order_audit_log IS 'Trigger function that automatically logs order changes';
