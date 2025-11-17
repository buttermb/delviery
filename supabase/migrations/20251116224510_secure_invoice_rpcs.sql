-- Migration: Secure invoice RPCs and robust invoice numbering
-- Date: 2025-11-16 22:45

-- 1) Ensure a robust, concurrent-safe invoice number generator
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year int NOT NULL CHECK (year >= 2000),
  counter bigint NOT NULL CHECK (counter > 0),
  PRIMARY KEY (tenant_id, year)
);

-- Unique index to guarantee invoice_number integrity (name chosen to be stable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique
  ON public.invoices (invoice_number);

-- Replace generate_invoice_number with UPSERT-based, concurrency-safe version
CREATE OR REPLACE FUNCTION public.generate_invoice_number(tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_year int := EXTRACT(YEAR FROM TIMEZONE('UTC', NOW()))::int;
  v_next bigint;
BEGIN
  SELECT slug INTO v_slug FROM public.tenants WHERE id = tenant_id;

  INSERT INTO public.invoice_counters (tenant_id, year, counter)
  VALUES (tenant_id, v_year, 1)
  ON CONFLICT (tenant_id, year)
  DO UPDATE SET counter = public.invoice_counters.counter + 1
  RETURNING counter INTO v_next;

  RETURN UPPER(COALESCE(v_slug, 'INV')) || '-INV-' || v_year::text || '-' || LPAD(v_next::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_number(uuid) IS 'Generates unique invoice number per tenant/year using an atomic counter (UPSERT).';

-- 2) Harden RPCs with explicit membership checks to avoid cross-tenant access

-- Secure get_tenant_invoices: require caller to be a member of the tenant
CREATE OR REPLACE FUNCTION public.get_tenant_invoices(tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Enforce membership for the caller
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = tenant_id
      AND tu.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

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
  ) INTO result
  FROM public.invoices i
  WHERE i.tenant_id = tenant_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_tenant_invoices(uuid) IS 'Returns all invoices for a tenant as a JSON array; enforces caller membership via tenant_users.';

-- Secure get_invoice: ensure the requested invoice belongs to a tenant the caller is a member of
CREATE OR REPLACE FUNCTION public.get_invoice(invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_tenant_id uuid;
BEGIN
  -- Fetch invoice tenant first
  SELECT i.tenant_id INTO v_tenant_id
  FROM public.invoices i
  WHERE i.id = invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  -- Enforce membership for the caller
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = v_tenant_id
      AND tu.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

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
  ) INTO result
  FROM public.invoices i
  WHERE i.id = invoice_id;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_invoice(uuid) IS 'Returns a single invoice as JSON; enforces caller membership via tenant_users.';

-- 3) Minimal privilege: ensure only authenticated role can execute these RPCs
-- Note: Existing GRANTs typically persist across CREATE OR REPLACE, but we enforce them here.
REVOKE ALL ON FUNCTION public.get_tenant_invoices(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_tenant_invoices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO authenticated;
