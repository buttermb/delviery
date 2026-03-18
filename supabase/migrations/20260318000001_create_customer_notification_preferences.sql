-- Create customer_notification_preferences table
-- Stores per-customer, per-tenant notification preference settings
-- Linked to the customers table (not auth.users) for proper tenant isolation

CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Email preferences
  email_enabled boolean NOT NULL DEFAULT true,
  email_order_updates boolean NOT NULL DEFAULT true,
  email_promotions boolean NOT NULL DEFAULT true,
  email_delivery_updates boolean NOT NULL DEFAULT true,

  -- SMS preferences
  sms_enabled boolean NOT NULL DEFAULT false,
  sms_order_updates boolean NOT NULL DEFAULT false,
  sms_delivery_updates boolean NOT NULL DEFAULT false,

  -- Push / in-app preferences
  push_enabled boolean NOT NULL DEFAULT true,
  push_order_updates boolean NOT NULL DEFAULT true,
  push_promotions boolean NOT NULL DEFAULT false,

  -- Quiet hours (optional)
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time DEFAULT '22:00',
  quiet_hours_end time DEFAULT '08:00',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One preference row per customer per tenant
  CONSTRAINT customer_notification_preferences_unique
    UNIQUE (customer_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant users can view customer notification preferences within their tenant
CREATE POLICY "customer_notification_preferences_select_tenant"
  ON public.customer_notification_preferences
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- RLS: Tenant users can insert customer notification preferences for their tenant
CREATE POLICY "customer_notification_preferences_insert_tenant"
  ON public.customer_notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- RLS: Tenant users can update customer notification preferences within their tenant
CREATE POLICY "customer_notification_preferences_update_tenant"
  ON public.customer_notification_preferences
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- RLS: Tenant users can delete customer notification preferences within their tenant
CREATE POLICY "customer_notification_preferences_delete_tenant"
  ON public.customer_notification_preferences
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_customer_notification_preferences_tenant
  ON public.customer_notification_preferences(tenant_id);

CREATE INDEX idx_customer_notification_preferences_customer
  ON public.customer_notification_preferences(customer_id);

CREATE INDEX idx_customer_notification_preferences_tenant_customer
  ON public.customer_notification_preferences(tenant_id, customer_id);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_customer_notification_preferences_updated_at
  BEFORE UPDATE ON public.customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Security definer function for upserting customer notification preferences
-- Callable from storefront (customers without auth.users accounts) via service role
CREATE OR REPLACE FUNCTION public.upsert_customer_notification_preferences(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_email_enabled boolean DEFAULT NULL,
  p_email_order_updates boolean DEFAULT NULL,
  p_email_promotions boolean DEFAULT NULL,
  p_email_delivery_updates boolean DEFAULT NULL,
  p_sms_enabled boolean DEFAULT NULL,
  p_sms_order_updates boolean DEFAULT NULL,
  p_sms_delivery_updates boolean DEFAULT NULL,
  p_push_enabled boolean DEFAULT NULL,
  p_push_order_updates boolean DEFAULT NULL,
  p_push_promotions boolean DEFAULT NULL,
  p_quiet_hours_enabled boolean DEFAULT NULL,
  p_quiet_hours_start time DEFAULT NULL,
  p_quiet_hours_end time DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- Verify the customer belongs to the tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer not found in tenant';
  END IF;

  INSERT INTO public.customer_notification_preferences (
    tenant_id,
    customer_id,
    email_enabled,
    email_order_updates,
    email_promotions,
    email_delivery_updates,
    sms_enabled,
    sms_order_updates,
    sms_delivery_updates,
    push_enabled,
    push_order_updates,
    push_promotions,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end
  ) VALUES (
    p_tenant_id,
    p_customer_id,
    COALESCE(p_email_enabled, true),
    COALESCE(p_email_order_updates, true),
    COALESCE(p_email_promotions, true),
    COALESCE(p_email_delivery_updates, true),
    COALESCE(p_sms_enabled, false),
    COALESCE(p_sms_order_updates, false),
    COALESCE(p_sms_delivery_updates, false),
    COALESCE(p_push_enabled, true),
    COALESCE(p_push_order_updates, true),
    COALESCE(p_push_promotions, false),
    COALESCE(p_quiet_hours_enabled, false),
    COALESCE(p_quiet_hours_start, '22:00'::time),
    COALESCE(p_quiet_hours_end, '08:00'::time)
  )
  ON CONFLICT (customer_id, tenant_id)
  DO UPDATE SET
    email_enabled = COALESCE(p_email_enabled, customer_notification_preferences.email_enabled),
    email_order_updates = COALESCE(p_email_order_updates, customer_notification_preferences.email_order_updates),
    email_promotions = COALESCE(p_email_promotions, customer_notification_preferences.email_promotions),
    email_delivery_updates = COALESCE(p_email_delivery_updates, customer_notification_preferences.email_delivery_updates),
    sms_enabled = COALESCE(p_sms_enabled, customer_notification_preferences.sms_enabled),
    sms_order_updates = COALESCE(p_sms_order_updates, customer_notification_preferences.sms_order_updates),
    sms_delivery_updates = COALESCE(p_sms_delivery_updates, customer_notification_preferences.sms_delivery_updates),
    push_enabled = COALESCE(p_push_enabled, customer_notification_preferences.push_enabled),
    push_order_updates = COALESCE(p_push_order_updates, customer_notification_preferences.push_order_updates),
    push_promotions = COALESCE(p_push_promotions, customer_notification_preferences.push_promotions),
    quiet_hours_enabled = COALESCE(p_quiet_hours_enabled, customer_notification_preferences.quiet_hours_enabled),
    quiet_hours_start = COALESCE(p_quiet_hours_start, customer_notification_preferences.quiet_hours_start),
    quiet_hours_end = COALESCE(p_quiet_hours_end, customer_notification_preferences.quiet_hours_end),
    updated_at = now()
  RETURNING row_to_json(customer_notification_preferences.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_customer_notification_preferences TO authenticated;
