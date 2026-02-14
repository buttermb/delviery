-- Create client notes table
CREATE TABLE IF NOT EXISTS public.wholesale_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'payment', 'order', 'warning')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_internal BOOLEAN DEFAULT true
);

-- Create inventory movements table
CREATE TABLE IF NOT EXISTS public.wholesale_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES public.wholesale_inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'transfer')),
  quantity_change NUMERIC NOT NULL,
  from_location TEXT,
  to_location TEXT,
  order_id UUID REFERENCES public.wholesale_orders(id) ON DELETE SET NULL,
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wholesale_client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client notes
CREATE POLICY "Authenticated users can view client notes"
  ON public.wholesale_client_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client notes"
  ON public.wholesale_client_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for inventory movements
CREATE POLICY "Authenticated users can view inventory movements"
  ON public.wholesale_inventory_movements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert inventory movements"
  ON public.wholesale_inventory_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_client_notes_client_id ON public.wholesale_client_notes(client_id);
CREATE INDEX idx_client_notes_created_at ON public.wholesale_client_notes(created_at DESC);
CREATE INDEX idx_inventory_movements_created_at ON public.wholesale_inventory_movements(created_at DESC);
CREATE INDEX idx_inventory_movements_product ON public.wholesale_inventory_movements(product_name);