/**
 * Abandoned Carts Table Migration
 * Tracks shopping carts that don't complete checkout for re-engagement
 */

-- Create abandoned_carts table
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  menu_id UUID,
  storefront_id UUID,
  cart_items JSONB NOT NULL DEFAULT '[]',
  total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recovered BOOLEAN NOT NULL DEFAULT FALSE,
  recovered_order_id UUID,
  recovered_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'unknown' CHECK (source IN ('menu', 'storefront', 'unknown'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant_id ON abandoned_carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session_id ON abandoned_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_id ON abandoned_carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_menu_id ON abandoned_carts(menu_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_storefront_id ON abandoned_carts(storefront_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovered ON abandoned_carts(recovered);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_created_at ON abandoned_carts(created_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant_recovered ON abandoned_carts(tenant_id, recovered);

-- Enable Row Level Security
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant users can view their own abandoned carts
CREATE POLICY "Tenant users can view own abandoned carts" ON abandoned_carts
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant users can insert abandoned carts for their tenant
CREATE POLICY "Tenant users can insert abandoned carts" ON abandoned_carts
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant users can update their own abandoned carts
CREATE POLICY "Tenant users can update own abandoned carts" ON abandoned_carts
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Tenant users can delete their own abandoned carts
CREATE POLICY "Tenant users can delete own abandoned carts" ON abandoned_carts
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- RLS Policy: Public can insert abandoned carts (for anonymous session tracking)
-- The service role or edge function will handle tenant_id assignment
CREATE POLICY "Public can insert abandoned carts with valid tenant" ON abandoned_carts
  FOR INSERT
  WITH CHECK (
    tenant_id IS NOT NULL
  );

-- RLS Policy: Customers can view their own abandoned carts
CREATE POLICY "Customers can view own abandoned carts" ON abandoned_carts
  FOR SELECT
  USING (
    customer_id = auth.uid()
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_abandoned_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER abandoned_carts_updated_at
  BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_abandoned_carts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE abandoned_carts IS 'Tracks shopping carts that do not complete checkout for re-engagement campaigns';
COMMENT ON COLUMN abandoned_carts.tenant_id IS 'The tenant this abandoned cart belongs to';
COMMENT ON COLUMN abandoned_carts.session_id IS 'Browser session ID for tracking anonymous users';
COMMENT ON COLUMN abandoned_carts.customer_id IS 'Optional: linked customer if identified';
COMMENT ON COLUMN abandoned_carts.customer_email IS 'Customer email for re-engagement';
COMMENT ON COLUMN abandoned_carts.customer_name IS 'Customer name for personalization';
COMMENT ON COLUMN abandoned_carts.menu_id IS 'The disposable menu this cart originated from';
COMMENT ON COLUMN abandoned_carts.storefront_id IS 'The storefront this cart originated from';
COMMENT ON COLUMN abandoned_carts.cart_items IS 'JSONB array of cart items with product_id, product_name, quantity, price';
COMMENT ON COLUMN abandoned_carts.total_value IS 'Total monetary value of the abandoned cart';
COMMENT ON COLUMN abandoned_carts.recovered IS 'Whether this cart was successfully recovered into an order';
COMMENT ON COLUMN abandoned_carts.recovered_order_id IS 'The order ID if the cart was recovered';
COMMENT ON COLUMN abandoned_carts.recovered_at IS 'Timestamp when the cart was recovered';
COMMENT ON COLUMN abandoned_carts.source IS 'Source of the abandoned cart: menu, storefront, or unknown';
