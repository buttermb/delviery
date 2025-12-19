-- Migration: Update RLS policies for encrypted columns
-- Date: 2025-01-01
-- Description: Ensures RLS policies work with encrypted columns (same as plaintext columns)

-- Note: RLS policies on tables automatically apply to all columns including encrypted ones
-- This migration ensures policies are correctly configured for multi-tenant isolation

-- ============================================================================
-- CUSTOMERS TABLE RLS
-- ============================================================================
-- Verify RLS is enabled (should already be enabled)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Ensure existing policies cover encrypted columns (they should by default)
-- Policies that reference tenant_id will automatically work with encrypted columns

-- ============================================================================
-- WHOLESALE_CLIENTS TABLE RLS
-- ============================================================================
ALTER TABLE public.wholesale_clients ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRODUCTS TABLE RLS
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORDERS TABLE RLS
-- ============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- WHOLESALE_ORDERS TABLE RLS
-- ============================================================================
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ADDITIONAL TABLES (if they exist)
-- ============================================================================
DO $$
BEGIN
  -- Transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Marketplace messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketplace_messages') THEN
    ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Customer invoices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_invoices') THEN
    ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Invoices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Note: Existing RLS policies will automatically apply to encrypted columns
-- No need to recreate policies - they work on the table level, not column level

COMMENT ON TABLE public.customers IS 'Customers table with zero-knowledge encryption support. Plaintext columns remain for hybrid migration.';
COMMENT ON TABLE public.wholesale_clients IS 'Wholesale clients table with zero-knowledge encryption support.';

