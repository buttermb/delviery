-- Add view tracking columns to crm_invoices
ALTER TABLE public.crm_invoices 
ADD COLUMN IF NOT EXISTS public_view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Create RPC function to get public invoice with view tracking
CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice JSONB;
    v_client JSONB;
BEGIN
    -- Get invoice by public token
    SELECT jsonb_build_object(
        'id', i.id,
        'account_id', i.account_id,
        'client_id', i.client_id,
        'invoice_number', i.invoice_number,
        'invoice_date', i.invoice_date,
        'due_date', i.due_date,
        'line_items', i.line_items,
        'subtotal', i.subtotal,
        'tax_rate', i.tax_rate,
        'tax_amount', i.tax_amount,
        'total', i.total,
        'status', i.status,
        'notes', i.notes,
        'public_token', i.public_token,
        'public_view_count', i.public_view_count,
        'last_viewed_at', i.last_viewed_at,
        'created_at', i.created_at,
        'updated_at', i.updated_at
    )
    INTO v_invoice
    FROM crm_invoices i
    WHERE i.public_token = p_token;

    -- Return null if not found
    IF v_invoice IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get client info
    SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'email', c.email,
        'phone', c.phone
    )
    INTO v_client
    FROM crm_clients c
    WHERE c.id = (v_invoice->>'client_id')::UUID;

    -- Add client to invoice
    v_invoice := v_invoice || jsonb_build_object('client', v_client);

    -- Update view count and last viewed timestamp
    UPDATE crm_invoices
    SET 
        public_view_count = COALESCE(public_view_count, 0) + 1,
        last_viewed_at = NOW()
    WHERE public_token = p_token;

    RETURN v_invoice;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_invoice(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(UUID) TO authenticated;

-- Add index for faster public token lookups
CREATE INDEX IF NOT EXISTS idx_crm_invoices_public_token ON public.crm_invoices(public_token);

COMMENT ON FUNCTION public.get_public_invoice IS 'Retrieves a public invoice by token and tracks view count';