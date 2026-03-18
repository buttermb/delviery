-- Migration: Add RPC functions for billing to fix JSON coercion errors
-- Phase 2: Fix JSON Coercion Errors

-- Function to get tenant billing information as single JSON object
CREATE OR REPLACE FUNCTION public.get_tenant_billing(tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tenant_record RECORD;
  plan_record RECORD;
BEGIN
  -- Get tenant data
  SELECT 
    t.id,
    t.subscription_plan,
    t.subscription_status,
    t.limits,
    t.usage,
    t.stripe_customer_id,
    t.created_at,
    t.owner_email,
    t.business_name
  INTO tenant_record
  FROM tenants t
  WHERE t.id = tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Tenant not found'
    );
  END IF;

  -- Get plan details if available
  SELECT * INTO plan_record
  FROM subscription_plans
  WHERE name = tenant_record.subscription_plan
  LIMIT 1;

  -- Build result as single JSON object
  result := jsonb_build_object(
    'plan', tenant_record.subscription_plan,
    'status', tenant_record.subscription_status,
    'limits', COALESCE(tenant_record.limits, '{}'::jsonb),
    'usage', COALESCE(tenant_record.usage, '{}'::jsonb),
    'stripe_customer_id', tenant_record.stripe_customer_id,
    'created_at', tenant_record.created_at,
    'owner_email', tenant_record.owner_email,
    'business_name', tenant_record.business_name,
    'plan_details', CASE 
      WHEN plan_record.id IS NOT NULL THEN
        jsonb_build_object(
          'name', plan_record.name,
          'display_name', plan_record.display_name,
          'description', plan_record.description,
          'price_monthly', plan_record.price_monthly,
          'price_yearly', plan_record.price_yearly,
          'features', COALESCE(plan_record.features, '[]'::jsonb),
          'limits', COALESCE(plan_record.limits, '{}'::jsonb)
        )
      ELSE NULL
    END
  );

  RETURN result;
END;
$$;

-- Function to get white label configuration as single JSON object
CREATE OR REPLACE FUNCTION public.get_white_label_config(tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  white_label_data jsonb;
BEGIN
  -- Get tenant white label data (stored as JSONB column)
  SELECT t.white_label INTO white_label_data
  FROM tenants t
  WHERE t.id = tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Tenant not found',
      'enabled', false
    );
  END IF;

  -- Return white_label JSONB directly as single object
  -- If null, return default structure
  IF white_label_data IS NULL THEN
    result := jsonb_build_object(
      'enabled', false,
      'domain', NULL,
      'logo', NULL,
      'favicon', NULL,
      'theme', jsonb_build_object(
        'primaryColor', '#10b981',
        'secondaryColor', '#3b82f6',
        'backgroundColor', '#ffffff',
        'textColor', '#111827',
        'accentColor', '#f59e0b',
        'customCSS', ''
      ),
      'emailFrom', NULL,
      'emailLogo', NULL,
      'emailFooter', NULL,
      'smsFrom', NULL
    );
  ELSE
    result := white_label_data;
  END IF;

  RETURN result;
END;
$$;

-- Function to get payment methods for a tenant as single JSON array
-- Note: Adjust based on actual payment_methods table structure
CREATE OR REPLACE FUNCTION public.get_payment_methods(tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get payment methods for tenant
  -- This assumes payment_methods table has tenant_id or is linked via tenant_users
  -- Adjust query based on actual schema
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'payment_type', pm.payment_type,
        'card_last_four', pm.card_last_four,
        'card_brand', pm.card_brand,
        'card_holder_name', pm.card_holder_name,
        'is_default', pm.is_default,
        'verified', pm.verified,
        'created_at', pm.created_at
      )
      ORDER BY pm.is_default DESC, pm.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM payment_methods pm
  WHERE EXISTS (
    SELECT 1 
    FROM tenant_users tu
    WHERE tu.tenant_id = tenant_id
    AND tu.user_id = pm.user_id
  );

  -- If no payment methods found, return empty array
  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_white_label_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_methods(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_tenant_billing(uuid) IS 'Returns tenant billing information as single JSON object to avoid coercion errors';
COMMENT ON FUNCTION public.get_white_label_config(uuid) IS 'Returns white label configuration as single JSON object';
COMMENT ON FUNCTION public.get_payment_methods(uuid) IS 'Returns payment methods for tenant as single JSON array';

