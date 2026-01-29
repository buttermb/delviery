-- ============================================
-- GDPR COMPLIANCE: ACCOUNT DELETION & DATA EXPORT
-- Phase 1: Critical Security & Compliance
-- ============================================

-- Add account deletion tracking to customer_users
ALTER TABLE public.customer_users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create data_export_requests table
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  export_format TEXT NOT NULL DEFAULT 'json', -- json, csv
  file_url TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_data_export_requests_customer_user ON public.data_export_requests(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_status ON public.data_export_requests(status);

-- Add RLS policies
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all requests (for edge functions)
CREATE POLICY "data_export_requests_service_role"
  ON public.data_export_requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to anonymize customer data (for GDPR deletion)
CREATE OR REPLACE FUNCTION public.anonymize_customer_data(customer_user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anonymize customer_users
  UPDATE public.customer_users
  SET 
    email = 'deleted_' || id::text || '@deleted.local',
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    password_hash = NULL,
    deleted_at = NOW()
  WHERE id = customer_user_id_param;

  -- Anonymize customers table (if linked)
  UPDATE public.customers
  SET 
    first_name = 'Deleted',
    last_name = 'User',
    email = NULL,
    phone = NULL
  WHERE id IN (
    SELECT customer_id FROM public.customer_users 
    WHERE id = customer_user_id_param
  );

  -- Note: Orders are kept for accounting but customer info is anonymized
  -- This maintains data integrity while complying with GDPR
END;
$$;

-- Function to clean up expired export files
CREATE OR REPLACE FUNCTION public.cleanup_expired_data_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.data_export_requests
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status = 'completed';
END;
$$;

-- Add comments
COMMENT ON TABLE public.data_export_requests IS 'Tracks GDPR data export requests from customers';
COMMENT ON COLUMN public.customer_users.deleted_at IS 'Timestamp when account was deleted (soft delete)';
COMMENT ON COLUMN public.customer_users.deletion_requested_at IS 'Timestamp when deletion was requested';
COMMENT ON FUNCTION public.anonymize_customer_data IS 'Anonymizes customer data for GDPR compliance while preserving order history';

