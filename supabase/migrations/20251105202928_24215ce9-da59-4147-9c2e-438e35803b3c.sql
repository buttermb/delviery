
-- ============================================================================
-- Add RLS Policies to 17 Tables - FINAL FIX (no is_public column)
-- ============================================================================

-- Activity Logs
CREATE POLICY "Users can view activity in their account" ON public.activity_logs FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING (is_admin_user());
CREATE POLICY "System can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Appointments
CREATE POLICY "Users can view appointments in their account" ON public.appointments FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create appointments in their account" ON public.appointments FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update appointments in their account" ON public.appointments FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can delete appointments in their account" ON public.appointments FOR DELETE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Customer Balances
CREATE POLICY "Users can view customer balances in their account" ON public.customer_balances FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update customer balances in their account" ON public.customer_balances FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "System can insert customer balances" ON public.customer_balances FOR INSERT WITH CHECK (true);

-- Customer Invoices
CREATE POLICY "Users can view invoices in their account" ON public.customer_invoices FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create invoices in their account" ON public.customer_invoices FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update invoices in their account" ON public.customer_invoices FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Customer Notes
CREATE POLICY "Users can view customer notes in their account" ON public.customer_notes FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create customer notes in their account" ON public.customer_notes FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update customer notes in their account" ON public.customer_notes FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can delete customer notes in their account" ON public.customer_notes FOR DELETE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Label Templates
CREATE POLICY "Users can view label templates in their account" ON public.label_templates FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create label templates in their account" ON public.label_templates FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update label templates in their account" ON public.label_templates FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can delete label templates in their account" ON public.label_templates FOR DELETE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Medical Patient Info
CREATE POLICY "Users can view medical info in their account" ON public.medical_patient_info FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create medical info in their account" ON public.medical_patient_info FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update medical info in their account" ON public.medical_patient_info FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Payment Records
CREATE POLICY "Users can view payment records in their account" ON public.payment_records FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create payment records in their account" ON public.payment_records FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update payment records in their account" ON public.payment_records FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Plans
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.plans FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Platform Invoices
CREATE POLICY "Accounts can view their platform invoices" ON public.platform_invoices FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Admins can manage all platform invoices" ON public.platform_invoices FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Purchase Order Items
CREATE POLICY "Users can view purchase order items in their account" ON public.purchase_order_items FOR SELECT USING (purchase_order_id IN (SELECT po.id FROM public.purchase_orders po JOIN public.profiles p ON po.account_id = p.account_id WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create purchase order items in their account" ON public.purchase_order_items FOR INSERT WITH CHECK (purchase_order_id IN (SELECT po.id FROM public.purchase_orders po JOIN public.profiles p ON po.account_id = p.account_id WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update purchase order items in their account" ON public.purchase_order_items FOR UPDATE USING (purchase_order_id IN (SELECT po.id FROM public.purchase_orders po JOIN public.profiles p ON po.account_id = p.account_id WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can delete purchase order items in their account" ON public.purchase_order_items FOR DELETE USING (purchase_order_id IN (SELECT po.id FROM public.purchase_orders po JOIN public.profiles p ON po.account_id = p.account_id WHERE p.user_id = auth.uid()));

-- Purchase Orders
CREATE POLICY "Users can view purchase orders in their account" ON public.purchase_orders FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can create purchase orders in their account" ON public.purchase_orders FOR INSERT WITH CHECK (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can update purchase orders in their account" ON public.purchase_orders FOR UPDATE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Users can delete purchase orders in their account" ON public.purchase_orders FOR DELETE USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Subscriptions
CREATE POLICY "Accounts can view their own subscription" ON public.subscriptions FOR SELECT USING (account_id IN (SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Menu Access
ALTER TABLE public.menu_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can access menus" ON public.menu_access FOR ALL USING (true) WITH CHECK (true);

-- Menu Products
ALTER TABLE public.menu_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view menu products" ON public.menu_products FOR SELECT USING (true);
CREATE POLICY "Users can manage menu products in their tenant" ON public.menu_products FOR ALL USING (menu_id IN (SELECT m.id FROM public.menus m JOIN public.tenant_users tu ON m.tenant_id = tu.tenant_id WHERE tu.user_id = auth.uid())) WITH CHECK (menu_id IN (SELECT m.id FROM public.menus m JOIN public.tenant_users tu ON m.tenant_id = tu.tenant_id WHERE tu.user_id = auth.uid()));

-- Menus
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view menus" ON public.menus FOR SELECT USING (true);
CREATE POLICY "Users can manage menus in their tenant" ON public.menus FOR ALL USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())) WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

-- Usage Events
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can view their usage events" ON public.usage_events FOR SELECT USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));
CREATE POLICY "Admins can view all usage events" ON public.usage_events FOR SELECT USING (is_admin_user());
CREATE POLICY "System can insert usage events" ON public.usage_events FOR INSERT WITH CHECK (true);
