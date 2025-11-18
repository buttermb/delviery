-- Migration: Add encrypted columns for zero-knowledge encryption
-- Date: 2025-01-01
-- Description: Adds _encrypted columns alongside existing plaintext columns for hybrid migration

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS email_search_index TEXT,
  ADD COLUMN IF NOT EXISTS phone_search_index TEXT,
  ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- ============================================================================
-- BUSINESSES / WHOLESALE_CLIENTS TABLE
-- ============================================================================
ALTER TABLE public.wholesale_clients
  ADD COLUMN IF NOT EXISTS business_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS license_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS contact_info_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS bank_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS business_name_search_index TEXT,
  ADD COLUMN IF NOT EXISTS license_number_search_index TEXT,
  ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS description_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS price_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS sku_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS supplier_info_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS name_search_index TEXT,
  ADD COLUMN IF NOT EXISTS sku_search_index TEXT,
  ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS items_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS total_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS customer_notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payment_info_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- ============================================================================
-- WHOLESALE_ORDERS TABLE
-- ============================================================================
ALTER TABLE public.wholesale_orders
  ADD COLUMN IF NOT EXISTS items_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS total_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS customer_notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS payment_info_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- ============================================================================
-- TRANSACTIONS TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS amount_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS payment_method_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS payment_details_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- MESSAGES TABLE (if exists - marketplace_messages)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketplace_messages') THEN
    ALTER TABLE public.marketplace_messages
      ADD COLUMN IF NOT EXISTS content_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS subject_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS attachments_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- DOCUMENTS TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS file_name_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS file_type_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS file_size_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS metadata_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- PROFILES TABLE (if exists - customer profiles)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS full_name_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS preferences_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- CUSTOMER_INVOICES TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_invoices') THEN
    ALTER TABLE public.customer_invoices
      ADD COLUMN IF NOT EXISTS line_items_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS customer_notes_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

-- ============================================================================
-- INVOICES TABLE (if exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS line_items_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS customer_notes_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;
  END IF;
END $$;

COMMENT ON COLUMN public.customers.name_encrypted IS 'Encrypted customer name (zero-knowledge encryption)';
COMMENT ON COLUMN public.customers.email_encrypted IS 'Encrypted customer email (zero-knowledge encryption)';
COMMENT ON COLUMN public.customers.email_search_index IS 'Deterministic hash for searching encrypted emails';
COMMENT ON COLUMN public.customers.encryption_metadata IS 'Encryption metadata (version, algorithm, timestamp)';

