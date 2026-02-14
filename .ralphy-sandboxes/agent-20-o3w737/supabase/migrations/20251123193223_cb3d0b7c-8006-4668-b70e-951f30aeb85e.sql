-- Fix RLS policies for realtime subscriptions
-- Enable realtime for critical tables that exist

-- Add tables to realtime publication (checking for existence first)
DO $$ 
BEGIN
  -- Enable realtime for wholesale_orders
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wholesale_orders') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wholesale_orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  
  -- Enable realtime for wholesale_inventory
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wholesale_inventory') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wholesale_inventory;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  
  -- Enable realtime for disposable_menus
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disposable_menus') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.disposable_menus;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  
  -- Enable realtime for customers
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Update RLS policies to allow realtime SELECT for authenticated users
-- wholesale_orders realtime policy
DROP POLICY IF EXISTS "Allow realtime subscriptions for wholesale_orders" ON public.wholesale_orders;
CREATE POLICY "Allow realtime subscriptions for wholesale_orders"
ON public.wholesale_orders
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.tenant_users WHERE tenant_id = wholesale_orders.tenant_id
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- wholesale_inventory realtime policy
DROP POLICY IF EXISTS "Allow realtime subscriptions for wholesale_inventory" ON public.wholesale_inventory;
CREATE POLICY "Allow realtime subscriptions for wholesale_inventory"
ON public.wholesale_inventory
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.tenant_users WHERE tenant_id = wholesale_inventory.tenant_id
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- disposable_menus realtime policy
DROP POLICY IF EXISTS "Allow realtime subscriptions for disposable_menus" ON public.disposable_menus;
CREATE POLICY "Allow realtime subscriptions for disposable_menus"
ON public.disposable_menus
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.tenant_users WHERE tenant_id = disposable_menus.tenant_id
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- customers realtime policy (customers use account_id, not tenant_id)
DROP POLICY IF EXISTS "Allow realtime subscriptions for customers" ON public.customers;
CREATE POLICY "Allow realtime subscriptions for customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() IN (
    SELECT tu.user_id 
    FROM public.tenant_users tu
    JOIN public.accounts a ON tu.tenant_id = a.tenant_id
    WHERE a.id = customers.account_id
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Seed 5 demo customers for all accounts that don't have customers yet
INSERT INTO public.customers (account_id, first_name, last_name, email, phone, address, city, state, zip_code, date_of_birth, loyalty_points, total_spent, created_at)
SELECT 
  a.id as account_id,
  CASE gs
    WHEN 1 THEN 'John'
    WHEN 2 THEN 'Sarah'
    WHEN 3 THEN 'Michael'
    WHEN 4 THEN 'Emily'
    WHEN 5 THEN 'David'
  END as first_name,
  CASE gs
    WHEN 1 THEN 'Smith'
    WHEN 2 THEN 'Johnson'
    WHEN 3 THEN 'Chen'
    WHEN 4 THEN 'Rodriguez'
    WHEN 5 THEN 'Kim'
  END as last_name,
  'customer' || gs || '@demo.com' as email,
  '555-000' || gs as phone,
  CASE gs
    WHEN 1 THEN '123 Main St'
    WHEN 2 THEN '456 Oak Ave'
    WHEN 3 THEN '789 Pine Rd'
    WHEN 4 THEN '321 Elm St'
    WHEN 5 THEN '654 Maple Dr'
  END as address,
  'New York' as city,
  'NY' as state,
  '1000' || gs as zip_code,
  '1990-01-01'::date as date_of_birth,
  (random() * 1000)::int as loyalty_points,
  (random() * 5000)::numeric(10,2) as total_spent,
  now() - (random() * interval '90 days') as created_at
FROM generate_series(1, 5) gs
CROSS JOIN public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers WHERE account_id = a.id
);