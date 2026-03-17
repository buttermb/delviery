-- Migration: Create delivery_proofs table for proof of delivery documentation
-- Stores photos, signatures, and location data for delivery confirmations

-- Create delivery_proofs table
CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_id UUID,
  order_id UUID,
  photo_url TEXT,
  signature_url TEXT,
  recipient_name TEXT,
  notes TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_tenant_id ON public.delivery_proofs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_delivery_id ON public.delivery_proofs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_order_id ON public.delivery_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_captured_at ON public.delivery_proofs(captured_at);

-- Enable RLS
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own delivery proofs
CREATE POLICY "Tenants can view own delivery proofs"
ON public.delivery_proofs
FOR SELECT
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can insert delivery proofs for their tenant
CREATE POLICY "Tenants can insert delivery proofs"
ON public.delivery_proofs
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can update their own delivery proofs
CREATE POLICY "Tenants can update own delivery proofs"
ON public.delivery_proofs
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);

-- Policy: Tenants can delete their own delivery proofs
CREATE POLICY "Tenants can delete own delivery proofs"
ON public.delivery_proofs
FOR DELETE
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid()
  )
);
