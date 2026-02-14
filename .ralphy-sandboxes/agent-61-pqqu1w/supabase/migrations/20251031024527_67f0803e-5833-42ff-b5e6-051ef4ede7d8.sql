-- Add RLS policies for wholesale tables

-- Wholesale Clients policies
CREATE POLICY "Admin users can view wholesale clients"
  ON public.wholesale_clients FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale clients"
  ON public.wholesale_clients FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Runners policies
CREATE POLICY "Admin users can view wholesale runners"
  ON public.wholesale_runners FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale runners"
  ON public.wholesale_runners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Inventory policies
CREATE POLICY "Admin users can view wholesale inventory"
  ON public.wholesale_inventory FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale inventory"
  ON public.wholesale_inventory FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Orders policies
CREATE POLICY "Admin users can view wholesale orders"
  ON public.wholesale_orders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale orders"
  ON public.wholesale_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Payments policies
CREATE POLICY "Admin users can view wholesale payments"
  ON public.wholesale_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale payments"
  ON public.wholesale_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Deliveries policies
CREATE POLICY "Admin users can view wholesale deliveries"
  ON public.wholesale_deliveries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage wholesale deliveries"
  ON public.wholesale_deliveries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Inventory Movements policies
CREATE POLICY "Admin users can view inventory movements"
  ON public.wholesale_inventory_movements FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage inventory movements"
  ON public.wholesale_inventory_movements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesale Client Notes policies
CREATE POLICY "Admin users can view client notes"
  ON public.wholesale_client_notes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin users can manage client notes"
  ON public.wholesale_client_notes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
