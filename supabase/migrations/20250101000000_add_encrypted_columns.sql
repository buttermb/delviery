-- ============================================================================
-- COMPLETELY SKIPPED: MIGRATION TIMELINE VIOLATION
-- ============================================================================
-- This migration (dated 2025-01-01) attempts to modify `customers` table,
-- but that table is created in 2025-10-30.
--
-- Therefore this migration always fails on a fresh sync.
-- The encrypted columns are likely added in the table creation or a later migration.
-- ============================================================================
/*
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
*/
