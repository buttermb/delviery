# Lovable Cloud Migration Guide

## Overview

This guide provides all the SQL migrations and functions needed to run the BigMike Wholesale Platform on Lovable (Supabase Cloud). Run these in order in the Supabase SQL Editor.

---

## Pre-Migration Checklist

Before running migrations:

1. **Backup your database** (if you have existing data)
2. Go to your Lovable/Supabase Dashboard → SQL Editor
3. Run each section in order
4. Wait for each section to complete before running the next

---

## Migration 1: Credit System Base (REQUIRED)

This creates the core credit system tables and functions.

```sql
-- ============================================================================
-- CREDIT SYSTEM MIGRATION
-- ============================================================================
-- Implements a freemium credit system for usage-based billing
-- Free tier users get credits, paid users have unlimited access
-- ============================================================================

-- Credit balances per tenant
CREATE TABLE IF NOT EXISTS public.tenant_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 500,
  lifetime_earned INTEGER NOT NULL DEFAULT 500,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  last_free_grant_at TIMESTAMPTZ DEFAULT now(),
  next_free_grant_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  warning_25_sent BOOLEAN DEFAULT false,
  warning_10_sent BOOLEAN DEFAULT false,
  warning_5_sent BOOLEAN DEFAULT false,
  warning_0_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Credit transaction history
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('free_grant', 'purchase', 'usage', 'refund', 'bonus', 'adjustment')),
  action_type TEXT,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credit packages for purchase
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  badge TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Action credit costs configuration
CREATE TABLE IF NOT EXISTS public.credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT UNIQUE NOT NULL,
  action_name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit analytics for conversion tracking
CREATE TABLE IF NOT EXISTS public.credit_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  credits_at_event INTEGER,
  action_attempted TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add credit-related columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_free_tier BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credits_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_credits_tenant_id ON public.tenant_credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credits_next_grant ON public.tenant_credits(next_free_grant_at) WHERE next_free_grant_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_id ON public.credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_analytics_tenant_id ON public.credit_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_analytics_event_type ON public.credit_analytics(event_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Tenants can view own credits" ON public.tenant_credits;
DROP POLICY IF EXISTS "Service role can manage all credits" ON public.tenant_credits;
DROP POLICY IF EXISTS "Tenants can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Service role can manage all transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Anyone can view active credit packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Service role can manage packages" ON public.credit_packages;
DROP POLICY IF EXISTS "Anyone can view active credit costs" ON public.credit_costs;
DROP POLICY IF EXISTS "Service role can manage costs" ON public.credit_costs;
DROP POLICY IF EXISTS "Tenants can view own analytics" ON public.credit_analytics;
DROP POLICY IF EXISTS "Service role can manage all analytics" ON public.credit_analytics;

-- tenant_credits policies
CREATE POLICY "Tenants can view own credits" ON public.tenant_credits
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all credits" ON public.tenant_credits
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_transactions policies
CREATE POLICY "Tenants can view own transactions" ON public.credit_transactions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all transactions" ON public.credit_transactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_packages policies (public read)
CREATE POLICY "Anyone can view active credit packages" ON public.credit_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage packages" ON public.credit_packages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_costs policies (public read)
CREATE POLICY "Anyone can view active credit costs" ON public.credit_costs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage costs" ON public.credit_costs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_analytics policies
CREATE POLICY "Tenants can view own analytics" ON public.credit_analytics
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all analytics" ON public.credit_analytics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## Migration 2: Credit Packages & Costs (REQUIRED)

Seed data for credit packages and action costs.

```sql
-- ============================================================================
-- SEED DATA: Credit Packages
-- ============================================================================

INSERT INTO public.credit_packages (name, slug, credits, price_cents, sort_order, badge, description) VALUES
  ('Starter Pack', 'starter-pack', 2500, 2999, 1, NULL, 'Great for light usage'),
  ('Growth Pack', 'growth-pack', 7500, 7999, 2, 'POPULAR', 'Most popular for growing businesses'),
  ('Power Pack', 'power-pack', 20000, 19999, 3, 'BEST VALUE', 'Best value for heavy users')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  sort_order = EXCLUDED.sort_order,
  badge = EXCLUDED.badge,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- SEED DATA: Credit Costs
-- ============================================================================

INSERT INTO public.credit_costs (action_key, action_name, credits, category, description) VALUES
  -- Orders
  ('create_order', 'Create Order', 100, 'orders', 'Create a new order'),
  ('update_order_status', 'Update Order Status', 25, 'orders', 'Change order status'),
  ('cancel_order', 'Cancel Order', 10, 'orders', 'Cancel an existing order'),
  
  -- Products
  ('add_product', 'Add Product', 50, 'inventory', 'Add a new product to catalog'),
  ('edit_product', 'Edit Product', 15, 'inventory', 'Update product details'),
  ('delete_product', 'Delete Product', 5, 'inventory', 'Remove a product'),
  ('bulk_import_products', 'Bulk Import Products', 200, 'inventory', 'Import multiple products'),
  
  -- Customers
  ('add_customer', 'Add Customer', 30, 'customers', 'Add a new customer'),
  ('edit_customer', 'Edit Customer', 10, 'customers', 'Update customer details'),
  ('delete_customer', 'Delete Customer', 5, 'customers', 'Remove a customer'),
  
  -- Invoices
  ('generate_invoice', 'Generate Invoice', 75, 'finance', 'Create an invoice'),
  ('send_invoice', 'Send Invoice', 50, 'finance', 'Email invoice to customer'),
  ('record_payment', 'Record Payment', 25, 'finance', 'Record a payment'),
  
  -- Communication
  ('send_sms', 'Send SMS', 75, 'communication', 'Send SMS notification'),
  ('send_email', 'Send Email', 25, 'communication', 'Send email notification'),
  ('send_menu_link', 'Send Menu Link', 50, 'communication', 'Share disposable menu'),
  
  -- Reports/Exports (FREE - Set to 0)
  ('generate_report', 'Generate Report', 0, 'reports', 'Generate analytics report'),
  ('export_csv', 'Export to CSV', 0, 'exports', 'Export data to CSV'),
  ('export_pdf', 'Export to PDF', 0, 'exports', 'Export data to PDF'),
  ('order_export', 'Export Orders', 0, 'exports', 'Export orders data'),
  ('customer_export', 'Export Customers', 0, 'exports', 'Export customer data'),
  ('invoice_export', 'Export Invoices', 0, 'exports', 'Export invoice data'),
  ('report_export', 'Export Report', 0, 'exports', 'Export report data'),
  
  -- AI Features
  ('menu_ocr', 'Menu OCR Scan', 250, 'ai', 'AI-powered menu scanning'),
  ('ai_suggestions', 'AI Suggestions', 100, 'ai', 'AI product suggestions'),
  ('ai_analytics', 'AI Analytics', 150, 'ai', 'AI-powered insights'),
  
  -- API Access
  ('api_call', 'API Call', 25, 'api', 'External API request'),
  
  -- Menus
  ('create_menu', 'Create Menu', 75, 'menus', 'Create disposable menu'),
  ('share_menu', 'Share Menu', 25, 'menus', 'Share menu link')
ON CONFLICT (action_key) DO UPDATE SET
  action_name = EXCLUDED.action_name,
  credits = EXCLUDED.credits,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();
```

---

## Migration 3: Credit Functions (REQUIRED)

Core functions for credit operations.

```sql
-- ============================================================================
-- FUNCTION: Get Credit Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_tenant_id UUID)
RETURNS TABLE (
  balance INTEGER,
  lifetime_earned INTEGER,
  lifetime_spent INTEGER,
  is_free_tier BOOLEAN,
  next_free_grant_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(tc.balance, 500),
    COALESCE(tc.lifetime_earned, 500),
    COALESCE(tc.lifetime_spent, 0),
    COALESCE(t.is_free_tier, false),
    tc.next_free_grant_at
  FROM public.tenants t
  LEFT JOIN public.tenant_credits tc ON tc.tenant_id = t.id
  WHERE t.id = p_tenant_id;
END;
$$;

-- ============================================================================
-- FUNCTION: Consume Credits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_tenant_id UUID,
  p_action_key TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  credits_cost INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_is_free_tier BOOLEAN;
BEGIN
  -- Get the credit cost for this action
  SELECT credits INTO v_cost
  FROM public.credit_costs
  WHERE action_key = p_action_key AND is_active = true;
  
  -- If cost not found in DB, check for zero cost (free action)
  IF v_cost IS NULL THEN
    v_cost := 0;
  END IF;
  
  -- If action is free, allow without checking balance
  IF v_cost = 0 THEN
    RETURN QUERY SELECT true, -1, 0, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if tenant is on free tier
  SELECT is_free_tier INTO v_is_free_tier
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- If not free tier, skip credit deduction
  IF v_is_free_tier IS NOT TRUE THEN
    RETURN QUERY SELECT true, -1, v_cost, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get current balance with lock
  SELECT balance INTO v_current_balance
  FROM public.tenant_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  
  -- If no credit record exists, create one
  IF v_current_balance IS NULL THEN
    INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
    VALUES (p_tenant_id, 500, 500)
    ON CONFLICT (tenant_id) DO NOTHING;
    v_current_balance := 500;
  END IF;
  
  -- Check if enough credits
  IF v_current_balance < v_cost THEN
    RETURN QUERY SELECT false, v_current_balance, v_cost, 'Insufficient credits. Need ' || v_cost || ', have ' || v_current_balance;
    RETURN;
  END IF;
  
  -- Deduct credits
  v_new_balance := v_current_balance - v_cost;
  
  UPDATE public.tenant_credits
  SET 
    balance = v_new_balance,
    lifetime_spent = lifetime_spent + v_cost,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  -- Record transaction
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    action_type,
    reference_id,
    reference_type,
    description
  ) VALUES (
    p_tenant_id,
    -v_cost,
    v_new_balance,
    'usage',
    p_action_key,
    p_reference_id,
    p_reference_type,
    COALESCE(p_description, 'Credit usage: ' || p_action_key)
  );
  
  RETURN QUERY SELECT true, v_new_balance, v_cost, NULL::TEXT;
END;
$$;

-- ============================================================================
-- FUNCTION: Grant Free Credits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.grant_free_credits(
  p_tenant_id UUID,
  p_amount INTEGER DEFAULT 500
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    last_free_grant_at = now(),
    next_free_grant_at = now() + interval '30 days',
    warning_25_sent = false,
    warning_10_sent = false,
    warning_5_sent = false,
    warning_0_sent = false,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'free_grant',
    'Monthly free credit grant'
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================================================
-- FUNCTION: Purchase Credits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purchase_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO public.tenant_credits (tenant_id, balance, lifetime_earned)
  VALUES (p_tenant_id, p_amount, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance = tenant_credits.balance + p_amount,
    lifetime_earned = tenant_credits.lifetime_earned + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  INSERT INTO public.credit_transactions (
    tenant_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    p_tenant_id,
    p_amount,
    v_new_balance,
    'purchase',
    'Credit purchase: ' || p_amount || ' credits',
    jsonb_build_object('stripe_payment_id', p_stripe_payment_id)
  );
  
  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;
```

---

## Migration 4: Data Exports Table (OPTIONAL)

For background export jobs.

```sql
-- Create data_exports table for background jobs
CREATE TABLE IF NOT EXISTS public.data_exports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid,
    data_type text NOT NULL,
    format text NOT NULL DEFAULT 'csv',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url text,
    error_message text,
    row_count integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their tenant's exports" ON public.data_exports;
DROP POLICY IF EXISTS "Users can create exports for their tenant" ON public.data_exports;

-- Policies
CREATE POLICY "Users can view their tenant's exports"
    ON public.data_exports FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create exports for their tenant"
    ON public.data_exports FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    ));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_data_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_data_exports_timestamp ON public.data_exports;
CREATE TRIGGER update_data_exports_timestamp
    BEFORE UPDATE ON public.data_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_data_exports_updated_at();

-- Storage Bucket for Exports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;
```

---

## Migration 5: Enhanced Credit System V3 (OPTIONAL)

Enhanced tracking columns for credit system.

```sql
-- Add usage tracking columns to tenant_credits
ALTER TABLE public.tenant_credits
ADD COLUMN IF NOT EXISTS credits_used_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS upgrade_triggers_shown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tier_status TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_weekly_reset TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_monthly_reset TIMESTAMPTZ DEFAULT now();

-- Credit grants table for promotional credits
CREATE TABLE IF NOT EXISTS public.credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  grant_type TEXT NOT NULL,
  promo_code TEXT,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_grants_tenant_id ON public.credit_grants(tenant_id);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own credit grants" ON public.credit_grants;
DROP POLICY IF EXISTS "Service role full access to credit_grants" ON public.credit_grants;

CREATE POLICY "Tenants can view own credit grants" ON public.credit_grants
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to credit_grants" ON public.credit_grants
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

---

## Verification Steps

After running all migrations, verify everything works:

### 1. Check Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenant_credits', 'credit_transactions', 'credit_packages', 'credit_costs', 'credit_analytics');
```

Expected: Should return 5 rows.

### 2. Check Functions Exist

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_credit_balance', 'consume_credits', 'grant_free_credits', 'purchase_credits');
```

Expected: Should return 4 rows.

### 3. Check Credit Packages

```sql
SELECT name, credits, price_cents FROM public.credit_packages ORDER BY sort_order;
```

Expected: 3 packages (Starter, Growth, Power).

### 4. Check Credit Costs

```sql
SELECT action_key, credits, category FROM public.credit_costs ORDER BY category, action_key;
```

Expected: ~25+ rows with different actions.

### 5. Test get_credit_balance Function

```sql
-- Replace with an actual tenant_id from your database
SELECT * FROM public.get_credit_balance('your-tenant-id-here'::uuid);
```

---

## Troubleshooting

### Error: "relation 'public.profiles' does not exist"

Some RLS policies reference `public.profiles`. If you don't have this table, you can either:

1. Create a simple profiles table:
```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

2. Or modify the RLS policies to use `tenant_users` instead (already done in this guide).

### Error: "function already exists"

This is safe to ignore - the `CREATE OR REPLACE` handles this.

### Error: "policy already exists"

Run the `DROP POLICY IF EXISTS` statements before creating new policies.

---

## Edge Functions Required

After database setup, deploy these edge functions:

1. **grant-free-credits** - Grants initial credits on signup
2. **stripe-webhook** - Handles credit purchases
3. **process-data-export** - Background export processing

These are in your `supabase/functions/` directory.

---

## Environment Variables

Ensure these are set in your Lovable project settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
STRIPE_SECRET_KEY=sk_live_xxx (in edge functions)
STRIPE_WEBHOOK_SECRET=whsec_xxx (in edge functions)
```

---

## Quick Test After Migration

1. Go to your app
2. Sign up as a new tenant with `is_free_tier = true`
3. Check that credit balance shows 500 credits
4. Perform a credit-consuming action
5. Verify balance decreases

If all tests pass, your migration is complete!





