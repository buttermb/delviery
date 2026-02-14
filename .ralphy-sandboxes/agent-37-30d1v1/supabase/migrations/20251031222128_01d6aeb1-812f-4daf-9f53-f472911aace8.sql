-- Add RLS policies for fronted_inventory tables to allow admin access

-- fronted_inventory table policies
DROP POLICY IF EXISTS "Admins can view all fronted inventory" ON public.fronted_inventory;
CREATE POLICY "Admins can view all fronted inventory"
ON public.fronted_inventory
FOR SELECT
TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "Admins can manage fronted inventory" ON public.fronted_inventory;
CREATE POLICY "Admins can manage fronted inventory"
ON public.fronted_inventory
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- fronted_inventory_scans table policies
DROP POLICY IF EXISTS "Admins can view all scans" ON public.fronted_inventory_scans;
CREATE POLICY "Admins can view all scans"
ON public.fronted_inventory_scans
FOR SELECT
TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "Admins can manage scans" ON public.fronted_inventory_scans;
CREATE POLICY "Admins can manage scans"
ON public.fronted_inventory_scans
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());

-- fronted_payments table policies  
DROP POLICY IF EXISTS "Admins can view all payments" ON public.fronted_payments;
CREATE POLICY "Admins can view all payments"
ON public.fronted_payments
FOR SELECT
TO authenticated
USING (is_admin_user());

DROP POLICY IF EXISTS "Admins can manage payments" ON public.fronted_payments;
CREATE POLICY "Admins can manage payments"
ON public.fronted_payments
FOR ALL
TO authenticated
USING (is_admin_user())
WITH CHECK (is_admin_user());