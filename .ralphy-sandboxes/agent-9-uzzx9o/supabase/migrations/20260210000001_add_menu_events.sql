-- Menu Events Table for Customer Interaction Tracking
-- Tracks: menu visits, product views, add-to-cart, checkout start, order complete
-- Used for conversion funnel analysis

CREATE TABLE IF NOT EXISTS menu_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES disposable_menus(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'view',           -- Customer visited menu
    'product_view',   -- Customer viewed product details
    'add_to_cart',    -- Customer added product to cart
    'checkout_start', -- Customer started checkout
    'order_complete'  -- Customer completed order
  )),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_menu_events_menu_id ON menu_events(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_events_session_id ON menu_events(session_id);
CREATE INDEX IF NOT EXISTS idx_menu_events_tenant_id ON menu_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_events_event_type ON menu_events(event_type);
CREATE INDEX IF NOT EXISTS idx_menu_events_created_at ON menu_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_events_customer_id ON menu_events(customer_id) WHERE customer_id IS NOT NULL;

-- Composite index for funnel analysis queries
CREATE INDEX IF NOT EXISTS idx_menu_events_funnel ON menu_events(menu_id, session_id, event_type, created_at);

-- Enable Row Level Security
ALTER TABLE menu_events ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant admins can view their menu events
CREATE POLICY "Tenant admins can view menu events"
  ON menu_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert menu events (for anonymous tracking)
CREATE POLICY "System can insert menu events"
  ON menu_events
  FOR INSERT
  WITH CHECK (true);

-- Policy: Super admins can view all events
CREATE POLICY "Super admins can view all menu events"
  ON menu_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Helper function to log menu events
CREATE OR REPLACE FUNCTION log_menu_event(
  p_tenant_id UUID,
  p_menu_id UUID,
  p_session_id TEXT,
  p_event_type TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO menu_events (
    tenant_id,
    menu_id,
    session_id,
    customer_id,
    event_type,
    product_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_menu_id,
    p_session_id,
    p_customer_id,
    p_event_type,
    p_product_id,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION log_menu_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_menu_event TO anon;

-- View for conversion funnel analysis
CREATE OR REPLACE VIEW menu_conversion_funnel AS
SELECT
  menu_id,
  tenant_id,
  DATE(created_at) AS event_date,
  COUNT(DISTINCT CASE WHEN event_type = 'view' THEN session_id END) AS total_views,
  COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN session_id END) AS product_views,
  COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END) AS add_to_carts,
  COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN session_id END) AS checkout_starts,
  COUNT(DISTINCT CASE WHEN event_type = 'order_complete' THEN session_id END) AS orders_completed,
  -- Conversion rates
  CASE
    WHEN COUNT(DISTINCT CASE WHEN event_type = 'view' THEN session_id END) > 0
    THEN ROUND(
      100.0 * COUNT(DISTINCT CASE WHEN event_type = 'order_complete' THEN session_id END) /
      COUNT(DISTINCT CASE WHEN event_type = 'view' THEN session_id END), 2
    )
    ELSE 0
  END AS overall_conversion_rate,
  CASE
    WHEN COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END) > 0
    THEN ROUND(
      100.0 * COUNT(DISTINCT CASE WHEN event_type = 'order_complete' THEN session_id END) /
      COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN session_id END), 2
    )
    ELSE 0
  END AS cart_to_order_rate
FROM menu_events
GROUP BY menu_id, tenant_id, DATE(created_at);

-- Add comment for documentation
COMMENT ON TABLE menu_events IS 'Tracks customer interactions with disposable menus for conversion funnel analysis';
COMMENT ON COLUMN menu_events.session_id IS 'Unique session identifier for anonymous tracking and session-based grouping';
COMMENT ON COLUMN menu_events.event_type IS 'Type of customer interaction: view, product_view, add_to_cart, checkout_start, order_complete';
