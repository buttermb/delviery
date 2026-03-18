-- Create tenant_payment_settings table
CREATE TABLE IF NOT EXISTS tenant_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Payment method toggles
  accept_cash BOOLEAN DEFAULT true,
  accept_zelle BOOLEAN DEFAULT false,
  accept_cashapp BOOLEAN DEFAULT false,
  accept_bitcoin BOOLEAN DEFAULT false,
  accept_lightning BOOLEAN DEFAULT false,
  accept_ethereum BOOLEAN DEFAULT false,
  accept_usdt BOOLEAN DEFAULT false,
  -- Payment details
  zelle_username TEXT,
  zelle_phone TEXT,
  cashapp_username TEXT,
  bitcoin_address TEXT,
  lightning_address TEXT,
  ethereum_address TEXT,
  usdt_address TEXT,
  -- Custom instructions
  cash_instructions TEXT,
  zelle_instructions TEXT,
  cashapp_instructions TEXT,
  crypto_instructions TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Add payment_settings column to disposable_menus for per-menu overrides
ALTER TABLE disposable_menus 
ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT NULL;

-- Enable RLS
ALTER TABLE tenant_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_payment_settings
CREATE POLICY "Tenants can view their own payment settings"
  ON tenant_payment_settings FOR SELECT
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can insert their own payment settings"
  ON tenant_payment_settings FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Tenants can update their own payment settings"
  ON tenant_payment_settings FOR UPDATE
  USING (tenant_id IN (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
  ));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tenant_payment_settings_updated_at ON tenant_payment_settings;
CREATE TRIGGER trigger_update_tenant_payment_settings_updated_at
  BEFORE UPDATE ON tenant_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_payment_settings_updated_at();

-- Grant permissions
GRANT ALL ON tenant_payment_settings TO authenticated;

-- Add comment
COMMENT ON TABLE tenant_payment_settings IS 'Stores payment method configuration and wallet addresses for each tenant';

