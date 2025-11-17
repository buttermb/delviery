-- Migration: Paginated tenant invoices RPC and supporting index
-- Date: 2025-11-16 23:10 UTC

-- Composite index to support keyset pagination by tenant
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created_id
  ON public.invoices (tenant_id, created_at DESC, id DESC);

-- Keyset‑paginated invoices RPC
CREATE OR REPLACE FUNCTION public.get_tenant_invoices_paged(
  tenant_id uuid,
  page_size int DEFAULT 50,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_size int := LEAST(GREATEST(page_size, 1), 200);
  v_items jsonb;
  v_next_cursor jsonb;
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

  WITH rows AS (
    SELECT
      i.id,
      i.customer_id,
      i.created_at,
      i.invoice_number,
      i.subtotal,
      i.tax,
      i.total,
      i.amount_paid,
      i.amount_due,
      COALESCE(i.line_items, '[]'::jsonb) AS line_items,
      i.billing_period_start,
      i.billing_period_end,
      i.issue_date,
      i.due_date,
      i.paid_at,
      i.status,
      i.stripe_invoice_id,
      i.stripe_payment_intent_id,
      i.updated_at
    FROM public.invoices i
    WHERE i.tenant_id = tenant_id
      AND (
        cursor_created_at IS NULL
        OR (i.created_at, i.id) < (cursor_created_at, cursor_id)
      )
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT v_page_size
  ),
  stats AS (
    SELECT COUNT(*) AS cnt FROM rows
  ),
  last AS (
    SELECT created_at, id FROM rows ORDER BY created_at DESC, id DESC LIMIT 1
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', rows.id,
        'customer_id', rows.customer_id,
        'invoice_number', rows.invoice_number,
        'subtotal', rows.subtotal,
        'tax', rows.tax,
        'total', rows.total,
        'amount_paid', rows.amount_paid,
        'amount_due', rows.amount_due,
        'line_items', rows.line_items,
        'billing_period_start', rows.billing_period_start,
        'billing_period_end', rows.billing_period_end,
        'issue_date', rows.issue_date,
        'due_date', rows.due_date,
        'paid_at', rows.paid_at,
        'status', rows.status,
        'stripe_invoice_id', rows.stripe_invoice_id,
        'stripe_payment_intent_id', rows.stripe_payment_intent_id,
        'created_at', rows.created_at,
        'updated_at', rows.updated_at
      )
      ORDER BY rows.created_at DESC, rows.id DESC
    ), '[]'::jsonb) AS items,
    CASE WHEN (SELECT cnt FROM stats) = v_page_size
      THEN (SELECT jsonb_build_object('created_at', last.created_at, 'id', last.id) FROM last)
      ELSE NULL
    END AS next_cursor
  INTO v_items, v_next_cursor
  FROM rows;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb), 'next_cursor', v_next_cursor);
END;
$$;

COMMENT ON FUNCTION public.get_tenant_invoices_paged(uuid, int, timestamptz, uuid) IS 'Keyset-paginated invoices for a tenant; returns {items, next_cursor}; enforces caller membership via tenant_users.';

REVOKE ALL ON FUNCTION public.get_tenant_invoices_paged(uuid, int, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_invoices_paged(uuid, int, timestamptz, uuid) TO authenticated;
