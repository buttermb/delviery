-- Create inventory_batches table for batch tracking
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id),
  quantity_lbs NUMERIC DEFAULT 0,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE,
  supplier_id UUID,
  cost_per_lb NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

-- Admins can manage batches
CREATE POLICY "Admins can manage inventory batches"
  ON public.inventory_batches
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_batches_account ON public.inventory_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON public.inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON public.inventory_batches(status);