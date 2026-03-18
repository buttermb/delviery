-- Create wholesale_suppliers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wholesale_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wholesale_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage suppliers"
  ON public.wholesale_suppliers
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Add missing columns to wholesale_payments
ALTER TABLE public.wholesale_payments
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to wholesale_inventory
ALTER TABLE public.wholesale_inventory
  ADD COLUMN IF NOT EXISTS cost_per_lb NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'Main Warehouse';

-- Add missing column to wholesale_orders
ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Add missing columns to wholesale_deliveries
ALTER TABLE public.wholesale_deliveries
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.wholesale_clients(id),
  ADD COLUMN IF NOT EXISTS total_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collection_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_weight NUMERIC DEFAULT 0;

-- Create supplier_transactions table
CREATE TABLE IF NOT EXISTS public.supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.wholesale_suppliers(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage supplier transactions"
  ON public.supplier_transactions
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier ON public.supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_deliveries_client ON public.wholesale_deliveries(client_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_payments_date ON public.wholesale_payments(payment_date DESC);