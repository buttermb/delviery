-- Migration: Create indexes for encrypted search fields
-- Date: 2025-01-01
-- Description: Creates indexes on _search_index columns for efficient encrypted field searching

-- ============================================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_email_search_index 
  ON public.customers(email_search_index) 
  WHERE email_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_phone_search_index 
  ON public.customers(phone_search_index) 
  WHERE phone_search_index IS NOT NULL;

-- ============================================================================
-- WHOLESALE_CLIENTS TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_wholesale_clients_business_name_search_index 
  ON public.wholesale_clients(business_name_search_index) 
  WHERE business_name_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wholesale_clients_license_number_search_index 
  ON public.wholesale_clients(license_number_search_index) 
  WHERE license_number_search_index IS NOT NULL;

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_name_search_index 
  ON public.products(name_search_index) 
  WHERE name_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_sku_search_index 
  ON public.products(sku_search_index) 
  WHERE sku_search_index IS NOT NULL;

-- ============================================================================
-- COMPOSITE INDEXES FOR TENANT ISOLATION + SEARCH
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_tenant_email_search 
  ON public.customers(tenant_id, email_search_index) 
  WHERE email_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone_search 
  ON public.customers(tenant_id, phone_search_index) 
  WHERE phone_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wholesale_clients_tenant_business_name_search 
  ON public.wholesale_clients(tenant_id, business_name_search_index) 
  WHERE business_name_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_name_search 
  ON public.products(tenant_id, name_search_index) 
  WHERE name_search_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_sku_search 
  ON public.products(tenant_id, sku_search_index) 
  WHERE sku_search_index IS NOT NULL;

COMMENT ON INDEX idx_customers_email_search_index IS 'Index for searching encrypted customer emails';
COMMENT ON INDEX idx_customers_phone_search_index IS 'Index for searching encrypted customer phone numbers';

