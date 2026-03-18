-- Customer Delivery Addresses Table
-- Stores multiple delivery addresses per customer with primary marking

CREATE TABLE IF NOT EXISTS customer_delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  street_address TEXT NOT NULL,
  apartment TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_delivery_addresses_customer
  ON customer_delivery_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_delivery_addresses_tenant
  ON customer_delivery_addresses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_delivery_addresses_primary
  ON customer_delivery_addresses(customer_id, is_primary) WHERE is_primary = TRUE;

-- Enable RLS
ALTER TABLE customer_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation for customer_delivery_addresses"
  ON customer_delivery_addresses
  FOR ALL
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- Trigger to ensure only one primary address per customer
CREATE OR REPLACE FUNCTION ensure_single_primary_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    UPDATE customer_delivery_addresses
    SET is_primary = FALSE, updated_at = NOW()
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_primary_address ON customer_delivery_addresses;
CREATE TRIGGER trigger_ensure_single_primary_address
  BEFORE INSERT OR UPDATE ON customer_delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_address();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_customer_delivery_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_delivery_addresses_updated_at ON customer_delivery_addresses;
CREATE TRIGGER trigger_update_customer_delivery_addresses_updated_at
  BEFORE UPDATE ON customer_delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_delivery_addresses_updated_at();
