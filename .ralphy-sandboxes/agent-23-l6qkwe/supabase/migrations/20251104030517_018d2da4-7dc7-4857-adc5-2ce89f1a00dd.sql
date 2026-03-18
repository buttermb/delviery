-- Add tenant_id to couriers table for multi-tenant support
ALTER TABLE public.couriers 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_couriers_tenant_id ON public.couriers(tenant_id);

-- Add tenant_id to orders table if not exists (for tenant isolation)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);

-- Update RLS policies for couriers table
DROP POLICY IF EXISTS "Couriers can view their own data" ON public.couriers;
DROP POLICY IF EXISTS "Couriers can update their own data" ON public.couriers;

-- Enable RLS
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Couriers can view their own data
CREATE POLICY "Couriers can view their own data" ON public.couriers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Couriers can update their own location and status
CREATE POLICY "Couriers can update their own data" ON public.couriers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage couriers in their tenant
CREATE POLICY "Tenant admins can manage couriers" ON public.couriers
  FOR ALL
  USING (
    tenant_id IN (
      SELECT a.tenant_id 
      FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Update RLS policies for orders table
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view available orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update assigned orders" ON public.orders;

-- Couriers can view orders assigned to them in their tenant
CREATE POLICY "Couriers can view assigned orders" ON public.orders
  FOR SELECT
  USING (
    courier_id IN (
      SELECT id FROM public.couriers WHERE user_id = auth.uid()
    )
  );

-- Couriers can view available orders in their tenant
CREATE POLICY "Couriers can view available orders" ON public.orders
  FOR SELECT
  USING (
    status = 'pending' 
    AND courier_id IS NULL
    AND tenant_id IN (
      SELECT tenant_id 
      FROM public.couriers 
      WHERE user_id = auth.uid()
    )
  );

-- Couriers can update their assigned orders
CREATE POLICY "Couriers can update assigned orders" ON public.orders
  FOR UPDATE
  USING (
    courier_id IN (
      SELECT id FROM public.couriers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    courier_id IN (
      SELECT id FROM public.couriers WHERE user_id = auth.uid()
    )
  );

-- Update courier_earnings table to include tenant filtering
DROP POLICY IF EXISTS "Couriers can view their own earnings" ON public.courier_earnings;

CREATE POLICY "Couriers can view their own earnings" ON public.courier_earnings
  FOR SELECT
  USING (
    courier_id IN (
      SELECT id FROM public.couriers WHERE user_id = auth.uid()
    )
  );

-- Function to auto-assign tenant_id to new orders from merchant's tenant
CREATE OR REPLACE FUNCTION auto_assign_order_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.merchant_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.merchants
    WHERE id = NEW.merchant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assigning tenant_id to orders
DROP TRIGGER IF EXISTS set_order_tenant_id ON public.orders;
CREATE TRIGGER set_order_tenant_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_order_tenant();