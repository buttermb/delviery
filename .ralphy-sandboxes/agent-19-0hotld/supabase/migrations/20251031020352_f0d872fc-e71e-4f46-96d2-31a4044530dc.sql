-- Create wholesale_clients table
CREATE TABLE IF NOT EXISTS public.wholesale_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('smoke_shop', 'bodega', 'distributor', 'other')),
  credit_limit NUMERIC(10,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_terms INTEGER NOT NULL DEFAULT 30,
  reliability_score INTEGER NOT NULL DEFAULT 100,
  monthly_volume NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_orders table
CREATE TABLE IF NOT EXISTS public.wholesale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_notes TEXT,
  runner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Create wholesale_order_items table
CREATE TABLE IF NOT EXISTS public.wholesale_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_runners table
CREATE TABLE IF NOT EXISTS public.wholesale_runners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  vehicle_plate TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_delivery', 'offline')),
  current_lat NUMERIC,
  current_lng NUMERIC,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_deliveries table
CREATE TABLE IF NOT EXISTS public.wholesale_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.wholesale_orders(id) ON DELETE RESTRICT,
  runner_id UUID NOT NULL REFERENCES public.wholesale_runners(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  current_location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_payments table
CREATE TABLE IF NOT EXISTS public.wholesale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'check', 'wire_transfer', 'card', 'other')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_inventory table
CREATE TABLE IF NOT EXISTS public.wholesale_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  warehouse_location TEXT NOT NULL DEFAULT 'main',
  quantity_lbs NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity_units INTEGER NOT NULL DEFAULT 0,
  reorder_point NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_restock_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wholesale_inventory_transfers table
CREATE TABLE IF NOT EXISTS public.wholesale_inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.wholesale_inventory(id) ON DELETE RESTRICT,
  runner_id UUID REFERENCES public.wholesale_runners(id) ON DELETE SET NULL,
  quantity_lbs NUMERIC(10,2) NOT NULL,
  quantity_units INTEGER NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add foreign key to wholesale_orders for runner
ALTER TABLE public.wholesale_orders 
ADD CONSTRAINT wholesale_orders_runner_id_fkey 
FOREIGN KEY (runner_id) REFERENCES public.wholesale_runners(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_wholesale_clients_status ON public.wholesale_clients(status);
CREATE INDEX idx_wholesale_clients_outstanding_balance ON public.wholesale_clients(outstanding_balance);
CREATE INDEX idx_wholesale_orders_client_id ON public.wholesale_orders(client_id);
CREATE INDEX idx_wholesale_orders_status ON public.wholesale_orders(status);
CREATE INDEX idx_wholesale_orders_runner_id ON public.wholesale_orders(runner_id);
CREATE INDEX idx_wholesale_order_items_order_id ON public.wholesale_order_items(order_id);
CREATE INDEX idx_wholesale_deliveries_order_id ON public.wholesale_deliveries(order_id);
CREATE INDEX idx_wholesale_deliveries_runner_id ON public.wholesale_deliveries(runner_id);
CREATE INDEX idx_wholesale_deliveries_status ON public.wholesale_deliveries(status);
CREATE INDEX idx_wholesale_payments_client_id ON public.wholesale_payments(client_id);
CREATE INDEX idx_wholesale_inventory_warehouse_location ON public.wholesale_inventory(warehouse_location);

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_wholesale_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'WO-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_wholesale_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_wholesale_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_wholesale_order_number_trigger
BEFORE INSERT ON public.wholesale_orders
FOR EACH ROW
EXECUTE FUNCTION set_wholesale_order_number();

-- Create function to update client reliability score
CREATE OR REPLACE FUNCTION update_client_reliability(
  p_client_id UUID,
  p_payment_made BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  IF p_payment_made THEN
    UPDATE public.wholesale_clients
    SET reliability_score = LEAST(100, reliability_score + 5)
    WHERE id = p_client_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to decrement wholesale inventory
CREATE OR REPLACE FUNCTION decrement_wholesale_inventory(
  p_product_name TEXT,
  p_quantity_lbs NUMERIC,
  p_quantity_units INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  current_lbs NUMERIC;
  current_units INTEGER;
BEGIN
  -- Get current stock with row lock
  SELECT quantity_lbs, quantity_units INTO current_lbs, current_units
  FROM public.wholesale_inventory
  WHERE product_name = p_product_name
  FOR UPDATE;
  
  -- Check if sufficient stock
  IF current_lbs IS NULL OR current_lbs < p_quantity_lbs OR current_units < p_quantity_units THEN
    RETURN FALSE;
  END IF;
  
  -- Decrement stock
  UPDATE public.wholesale_inventory
  SET 
    quantity_lbs = quantity_lbs - p_quantity_lbs,
    quantity_units = quantity_units - p_quantity_units,
    updated_at = NOW()
  WHERE product_name = p_product_name;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all wholesale tables
ALTER TABLE public.wholesale_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_inventory_transfers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Admins can manage wholesale_clients"
ON public.wholesale_clients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_orders"
ON public.wholesale_orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_order_items"
ON public.wholesale_order_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_runners"
ON public.wholesale_runners FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_deliveries"
ON public.wholesale_deliveries FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_payments"
ON public.wholesale_payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_inventory"
ON public.wholesale_inventory FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage wholesale_inventory_transfers"
ON public.wholesale_inventory_transfers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));