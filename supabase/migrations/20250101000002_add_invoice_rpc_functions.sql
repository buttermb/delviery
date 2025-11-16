-- Migration: Add RPC functions for invoice management
-- Phase 5: Advanced Invoice Management

-- Function to get tenant invoices as single JSON array
CREATE OR REPLACE FUNCTION public.get_tenant_invoices(tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'invoice_number', i.invoice_number,
        'subtotal', i.subtotal,
        'tax', i.tax,
        'total', i.total,
        'amount_paid', i.amount_paid,
        'amount_due', i.amount_due,
        'line_items', COALESCE(i.line_items, '[]'::jsonb),
        'billing_period_start', i.billing_period_start,
        'billing_period_end', i.billing_period_end,
        'issue_date', i.issue_date,
        'due_date', i.due_date,
        'paid_at', i.paid_at,
        'status', i.status,
        'stripe_invoice_id', i.stripe_invoice_id,
        'stripe_payment_intent_id', i.stripe_payment_intent_id,
        'created_at', i.created_at,
        'updated_at', i.updated_at
      )
      ORDER BY i.issue_date DESC, i.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM invoices i
  WHERE i.tenant_id = tenant_id;

  IF result IS NULL THEN
    result := '[]'::jsonb;
  END IF;

  RETURN result;
END;
$$;

-- Function to get single invoice as JSON object
CREATE OR REPLACE FUNCTION public.get_invoice(invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', i.id,
    'tenant_id', i.tenant_id,
    'invoice_number', i.invoice_number,
    'subtotal', i.subtotal,
    'tax', i.tax,
    'total', i.total,
    'amount_paid', i.amount_paid,
    'amount_due', i.amount_due,
    'line_items', COALESCE(i.line_items, '[]'::jsonb),
    'billing_period_start', i.billing_period_start,
    'billing_period_end', i.billing_period_end,
    'issue_date', i.issue_date,
    'due_date', i.due_date,
    'paid_at', i.paid_at,
    'status', i.status,
    'stripe_invoice_id', i.stripe_invoice_id,
    'stripe_payment_intent_id', i.stripe_payment_intent_id,
    'created_at', i.created_at,
    'updated_at', i.updated_at
  )
  INTO result
  FROM invoices i
  WHERE i.id = invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  RETURN result;
END;
$$;

-- Function to generate unique invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(tenant_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number TEXT;
  v_count INTEGER;
  v_tenant_slug TEXT;
BEGIN
  -- Get tenant slug for prefix
  SELECT slug INTO v_tenant_slug
  FROM tenants
  WHERE id = tenant_id;

  -- Get count of invoices for this tenant this year
  SELECT COUNT(*) INTO v_count
  FROM invoices
  WHERE invoices.tenant_id = tenant_id
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  -- Generate invoice number: {TENANT_SLUG}-INV-{YEAR}-{SEQUENCE}
  v_invoice_number := UPPER(COALESCE(v_tenant_slug, 'INV')) || '-INV-' || 
                      TO_CHAR(NOW(), 'YYYY') || '-' || 
                      LPAD((v_count + 1)::TEXT, 6, '0');

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_number = v_invoice_number) LOOP
    v_count := v_count + 1;
    v_invoice_number := UPPER(COALESCE(v_tenant_slug, 'INV')) || '-INV-' || 
                       TO_CHAR(NOW(), 'YYYY') || '-' || 
                       LPAD((v_count + 1)::TEXT, 6, '0');
  END LOOP;

  RETURN v_invoice_number;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_tenant_invoices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_tenant_invoices(uuid) IS 'Returns all invoices for a tenant as single JSON array';
COMMENT ON FUNCTION public.get_invoice(uuid) IS 'Returns single invoice as JSON object';
COMMENT ON FUNCTION public.generate_invoice_number(uuid) IS 'Generates unique invoice number for tenant';

