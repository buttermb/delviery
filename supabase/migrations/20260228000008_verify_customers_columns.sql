-- Verify customers table has all needed columns for storefront checkout flow
-- Required: id, tenant_id, name, phone, email, preferred_contact_method,
--   source, type, total_orders, total_spent, first_order_at, last_order_at,
--   admin_notes, created_at, updated_at
--
-- Already exist: id, tenant_id, phone, email, total_spent, created_at, updated_at
-- Added in 20260228000006: total_orders, preferred_contact (covers preferred_contact_method)
-- Adding here: name (generated), source, type, first_order_at, last_order_at, admin_notes

-- Generated column for full name (computed from first_name + last_name)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS (
  trim(first_name || ' ' || COALESCE(NULLIF(last_name, ''), ''))
) STORED;

-- Source channel: how the customer record was created
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Registration type: guest vs registered (distinct from customer_type which is recreational/medical)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'guest';

-- First order timestamp
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ;

-- Last order timestamp
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ;

-- Admin notes for internal use
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Index for tenant-first lookups by phone
-- Note: idx_customers_phone_tenant (phone, tenant_id) exists from 20260228000006
-- This index optimizes queries that filter by tenant_id first
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone
  ON public.customers(tenant_id, phone)
  WHERE phone IS NOT NULL;
