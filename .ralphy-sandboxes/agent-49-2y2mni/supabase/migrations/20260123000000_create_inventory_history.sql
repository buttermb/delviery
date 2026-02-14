-- Create inventory_history table for comprehensive inventory audit trail
-- Tracks all inventory changes: stock in, stock out, transfers, adjustments, sales, returns

CREATE TABLE IF NOT EXISTS public.inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'stock_in', 'stock_out', 'transfer', 'adjustment', 'sale', 'return', 'receiving', 'disposal'
  )),
  previous_quantity NUMERIC NOT NULL DEFAULT 0,
  new_quantity NUMERIC NOT NULL DEFAULT 0,
  change_amount NUMERIC NOT NULL DEFAULT 0,
  reference_type TEXT, -- e.g. 'order', 'transfer', 'purchase_order', 'manual'
  reference_id UUID, -- ID of the related entity (order_id, transfer_id, etc.)
  location_id UUID, -- warehouse/location where change occurred
  batch_id UUID, -- optional batch reference
  reason TEXT, -- human-readable reason for the change
  notes TEXT, -- additional notes for auditing
  performed_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb, -- flexible additional data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: tenant isolation - users can only see history for their tenant
CREATE POLICY "inventory_history_tenant_isolation"
  ON public.inventory_history
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Performance indexes
CREATE INDEX idx_inventory_history_tenant_id ON public.inventory_history(tenant_id);
CREATE INDEX idx_inventory_history_product_id ON public.inventory_history(product_id);
CREATE INDEX idx_inventory_history_change_type ON public.inventory_history(change_type);
CREATE INDEX idx_inventory_history_created_at ON public.inventory_history(created_at DESC);
CREATE INDEX idx_inventory_history_tenant_product ON public.inventory_history(tenant_id, product_id);
CREATE INDEX idx_inventory_history_tenant_created ON public.inventory_history(tenant_id, created_at DESC);
CREATE INDEX idx_inventory_history_reference ON public.inventory_history(reference_type, reference_id);

-- Comment for documentation
COMMENT ON TABLE public.inventory_history IS 'Comprehensive inventory audit trail tracking all stock changes';
COMMENT ON COLUMN public.inventory_history.change_type IS 'Type of inventory change: stock_in, stock_out, transfer, adjustment, sale, return, receiving, disposal';
COMMENT ON COLUMN public.inventory_history.reference_type IS 'Type of entity that triggered the change (order, transfer, purchase_order, manual)';
COMMENT ON COLUMN public.inventory_history.metadata IS 'Flexible JSONB field for additional context (e.g. batch details, compliance info)';
