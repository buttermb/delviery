-- ============================================================================
-- UNIFIED ORDERS TABLE
-- Consolidates: orders, menu_orders, wholesale_orders, pos_transactions
-- ============================================================================

-- Create unified_orders table
CREATE TABLE IF NOT EXISTS unified_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  
  -- Order type discrimination
  order_type text NOT NULL CHECK (order_type IN ('retail', 'wholesale', 'menu', 'pos')),
  source text NOT NULL CHECK (source IN ('portal', 'menu_link', 'pos_terminal', 'b2b', 'admin', 'api')),
  
  -- Common order fields
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'processing', 'in_transit', 'delivered', 
    'completed', 'cancelled', 'rejected', 'refunded'
  )),
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  
  -- Payment
  payment_method text CHECK (payment_method IN ('cash', 'card', 'credit', 'debit', 'check', 'wire', 'crypto', 'other')),
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_reference text,
  
  -- Relationships (nullable based on order_type)
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  wholesale_client_id uuid REFERENCES wholesale_clients(id) ON DELETE SET NULL,
  menu_id uuid REFERENCES disposable_menus(id) ON DELETE SET NULL,
  whitelist_id uuid REFERENCES menu_access_whitelist(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES pos_shifts(id) ON DELETE SET NULL,
  
  -- Delivery fields
  delivery_address text,
  delivery_notes text,
  courier_id uuid REFERENCES couriers(id) ON DELETE SET NULL,
  scheduled_delivery_at timestamptz,
  delivered_at timestamptz,
  
  -- Contact info (for menu orders without customer record)
  contact_name text,
  contact_phone text,
  contact_email text,
  
  -- Type-specific data stored as JSON
  metadata jsonb DEFAULT '{}',
  
  -- Audit
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  
  -- Constraints
  CONSTRAINT unified_orders_tenant_order_number_unique UNIQUE (tenant_id, order_number)
);

-- Create unified_order_items table
CREATE TABLE IF NOT EXISTS unified_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES unified_orders(id) ON DELETE CASCADE,
  
  -- Product reference (nullable - can be custom item)
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  inventory_id uuid REFERENCES wholesale_inventory(id) ON DELETE SET NULL,
  
  -- Item details
  product_name text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 1,
  quantity_unit text DEFAULT 'each' CHECK (quantity_unit IN ('each', 'lb', 'oz', 'g', 'unit')),
  unit_price numeric NOT NULL DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS ((quantity * unit_price) - discount_amount) STORED,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_unified_orders_tenant ON unified_orders(tenant_id);
CREATE INDEX idx_unified_orders_type ON unified_orders(tenant_id, order_type);
CREATE INDEX idx_unified_orders_status ON unified_orders(tenant_id, status);
CREATE INDEX idx_unified_orders_created ON unified_orders(tenant_id, created_at DESC);
CREATE INDEX idx_unified_orders_customer ON unified_orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_unified_orders_client ON unified_orders(wholesale_client_id) WHERE wholesale_client_id IS NOT NULL;
CREATE INDEX idx_unified_orders_menu ON unified_orders(menu_id) WHERE menu_id IS NOT NULL;
CREATE INDEX idx_unified_orders_shift ON unified_orders(shift_id) WHERE shift_id IS NOT NULL;

-- Partial indexes for fast type-specific queries
CREATE INDEX idx_unified_orders_wholesale ON unified_orders(tenant_id, created_at DESC) 
  WHERE order_type = 'wholesale';
CREATE INDEX idx_unified_orders_menu_type ON unified_orders(tenant_id, menu_id, created_at DESC) 
  WHERE order_type = 'menu';
CREATE INDEX idx_unified_orders_pos ON unified_orders(tenant_id, shift_id, created_at DESC) 
  WHERE order_type = 'pos';
CREATE INDEX idx_unified_orders_retail ON unified_orders(tenant_id, created_at DESC) 
  WHERE order_type = 'retail';

-- Order items indexes
CREATE INDEX idx_unified_order_items_order ON unified_order_items(order_id);
CREATE INDEX idx_unified_order_items_product ON unified_order_items(product_id) WHERE product_id IS NOT NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_unified_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unified_orders_updated_at
  BEFORE UPDATE ON unified_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_orders_updated_at();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_unified_order_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix text;
  seq_num integer;
BEGIN
  -- Determine prefix based on order type
  prefix := CASE NEW.order_type
    WHEN 'wholesale' THEN 'WO'
    WHEN 'menu' THEN 'MO'
    WHEN 'pos' THEN 'POS'
    ELSE 'ORD'
  END;
  
  -- Get next sequence number for this tenant and type
  SELECT COALESCE(MAX(
    CASE 
      WHEN order_number ~ ('^' || prefix || '-[0-9]+$')
      THEN CAST(SUBSTRING(order_number FROM (prefix || '-([0-9]+)$')) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM unified_orders
  WHERE tenant_id = NEW.tenant_id
    AND order_type = NEW.order_type;
  
  NEW.order_number := prefix || '-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unified_orders_generate_number
  BEFORE INSERT ON unified_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_unified_order_number();

-- ============================================================================
-- BACKWARD-COMPATIBLE VIEWS
-- These allow existing code to keep working while we migrate
-- ============================================================================

-- View: wholesale_orders_unified (mirrors wholesale_orders structure)
CREATE OR REPLACE VIEW wholesale_orders_unified AS
SELECT 
  uo.id,
  uo.tenant_id,
  uo.order_number,
  uo.wholesale_client_id as client_id,
  uo.courier_id as runner_id,
  uo.status,
  uo.payment_status,
  uo.total_amount,
  uo.delivery_address,
  uo.delivery_notes,
  uo.scheduled_delivery_at,
  uo.delivered_at,
  (uo.metadata->>'collect_outstanding')::boolean as collect_outstanding,
  uo.created_at,
  uo.updated_at,
  uo.cancelled_at,
  uo.cancellation_reason,
  uo.metadata
FROM unified_orders uo
WHERE uo.order_type = 'wholesale';

-- View: menu_orders_unified (mirrors menu_orders structure)
CREATE OR REPLACE VIEW menu_orders_unified AS
SELECT
  uo.id,
  uo.tenant_id,
  uo.menu_id,
  uo.whitelist_id,
  uo.contact_phone,
  uo.contact_name,
  uo.contact_email,
  uo.status,
  uo.total_amount,
  uo.payment_status,
  uo.delivery_address,
  (uo.metadata->>'items')::jsonb as items,
  uo.created_at,
  uo.updated_at,
  uo.metadata
FROM unified_orders uo
WHERE uo.order_type = 'menu';

-- View: pos_transactions_unified (mirrors pos_transactions structure)
CREATE OR REPLACE VIEW pos_transactions_unified AS
SELECT
  uo.id,
  uo.tenant_id,
  uo.order_number as transaction_number,
  uo.shift_id,
  uo.customer_id,
  uo.subtotal,
  uo.tax_amount,
  uo.discount_amount,
  uo.total_amount,
  uo.payment_method,
  uo.payment_status,
  uo.payment_reference,
  (uo.metadata->>'items')::jsonb as items,
  (uo.metadata->>'receipt_number')::text as receipt_number,
  uo.created_at,
  uo.created_by as cashier_id,
  uo.metadata
FROM unified_orders uo
WHERE uo.order_type = 'pos';

-- View: retail_orders_unified (mirrors orders structure)
CREATE OR REPLACE VIEW retail_orders_unified AS
SELECT
  uo.id,
  uo.tenant_id,
  uo.order_number,
  uo.customer_id,
  uo.status,
  uo.subtotal,
  uo.tax_amount,
  uo.discount_amount,
  uo.total_amount,
  uo.payment_method,
  uo.payment_status,
  uo.delivery_address,
  uo.delivery_notes,
  uo.courier_id,
  uo.scheduled_delivery_at,
  uo.delivered_at,
  uo.created_at,
  uo.updated_at,
  uo.cancelled_at,
  uo.metadata
FROM unified_orders uo
WHERE uo.order_type = 'retail';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE unified_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_order_items ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for unified_orders
CREATE POLICY "unified_orders_tenant_isolation" ON unified_orders
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);

-- Tenant isolation policy for unified_order_items
CREATE POLICY "unified_order_items_tenant_isolation" ON unified_order_items
FOR ALL USING (
  order_id IN (
    SELECT id FROM unified_orders WHERE tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create an order with items atomically
CREATE OR REPLACE FUNCTION create_unified_order(
  p_tenant_id uuid,
  p_order_type text,
  p_source text,
  p_items jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_wholesale_client_id uuid DEFAULT NULL,
  p_menu_id uuid DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_courier_id uuid DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_item jsonb;
BEGIN
  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );
  END LOOP;

  -- Insert order
  INSERT INTO unified_orders (
    tenant_id, order_type, source,
    customer_id, wholesale_client_id, menu_id, shift_id,
    subtotal, total_amount,
    delivery_address, delivery_notes,
    payment_method, courier_id,
    contact_name, contact_phone,
    metadata
  ) VALUES (
    p_tenant_id, p_order_type, p_source,
    p_customer_id, p_wholesale_client_id, p_menu_id, p_shift_id,
    v_subtotal, v_subtotal, -- tax calculated separately if needed
    p_delivery_address, p_delivery_notes,
    p_payment_method, p_courier_id,
    p_contact_name, p_contact_phone,
    p_metadata
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  INSERT INTO unified_order_items (
    order_id, product_id, inventory_id,
    product_name, sku, quantity, quantity_unit, unit_price,
    metadata
  )
  SELECT 
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'inventory_id')::uuid,
    item->>'product_name',
    item->>'sku',
    (item->>'quantity')::numeric,
    COALESCE(item->>'quantity_unit', 'each'),
    (item->>'unit_price')::numeric,
    COALESCE(item->'metadata', '{}')
  FROM jsonb_array_elements(p_items) item;

  RETURN v_order_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_unified_order TO authenticated;

COMMENT ON TABLE unified_orders IS 'Unified orders table consolidating retail, wholesale, menu, and POS orders';
COMMENT ON TABLE unified_order_items IS 'Line items for unified orders';

