-- ============================================================================
-- COMPLETELY SKIPPED: MIGRATION TIMELINE VIOLATION
-- ============================================================================
-- This migration (dated 2025-01-15) attempts to create triggers on:
-- - orders (Created Oct 2025)
-- - wholesale_orders (Created Nov 2025)
--
-- Therefore this migration fails on a fresh sync.
-- ============================================================================
/*
-- Function to restore inventory for regular orders (products table)
CREATE OR REPLACE FUNCTION public.restore_order_inventory()
...
*/
