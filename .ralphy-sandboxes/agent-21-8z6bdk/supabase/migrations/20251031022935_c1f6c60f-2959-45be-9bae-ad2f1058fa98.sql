-- Create inventory_transfers table
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.wholesale_inventory(id) ON DELETE CASCADE,
  from_warehouse TEXT NOT NULL,
  to_warehouse TEXT NOT NULL,
  quantity_lbs NUMERIC(10,2) NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create inventory_adjustments table
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.wholesale_inventory(id) ON DELETE CASCADE,
  warehouse TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'subtract')),
  quantity_lbs NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view transfers" ON public.inventory_transfers FOR SELECT USING (true);
CREATE POLICY "Admins can create transfers" ON public.inventory_transfers FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view adjustments" ON public.inventory_adjustments FOR SELECT USING (true);
CREATE POLICY "Admins can create adjustments" ON public.inventory_adjustments FOR INSERT WITH CHECK (true);
