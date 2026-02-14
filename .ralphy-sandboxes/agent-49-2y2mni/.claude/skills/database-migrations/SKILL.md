---
name: database-migrations
description: Supabase PostgreSQL migration patterns for FloraIQ. RLS policies, tenant isolation, security definer functions, and naming conventions.
---

# Database Migrations Skill

## Migration File Naming

```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Example: `20251218130000_add_customer_credits.sql`

## Table Creation Template

```sql
-- Create table with tenant isolation
CREATE TABLE IF NOT EXISTS public.customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies with tenant isolation
CREATE POLICY "Tenant isolation" ON public.customer_credits
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_customer_credits_tenant ON public.customer_credits(tenant_id);
CREATE INDEX idx_customer_credits_customer ON public.customer_credits(customer_id);
```

## RLS Policy Patterns

### Read-only for tenant users
```sql
CREATE POLICY "Users can view their tenant data" ON public.table_name
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
```

### Full access for tenant admins
```sql
CREATE POLICY "Admins can manage tenant data" ON public.table_name
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### Public read access
```sql
CREATE POLICY "Public can read published items" ON public.table_name
  FOR SELECT
  USING (is_published = true);
```

## Security Definer Functions

```sql
-- CRITICAL: Always set search_path
CREATE OR REPLACE FUNCTION public.get_tenant_stats(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- REQUIRED
AS $$
DECLARE
  result json;
BEGIN
  -- Verify caller has access to tenant
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_orders', (SELECT count(*) FROM orders WHERE tenant_id = p_tenant_id),
    'total_revenue', (SELECT coalesce(sum(total), 0) FROM orders WHERE tenant_id = p_tenant_id)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tenant_stats(uuid) TO authenticated;
```

## Common Patterns

### Soft Delete
```sql
ALTER TABLE public.table_name ADD COLUMN deleted_at timestamptz;

-- Update RLS to exclude deleted
CREATE POLICY "Exclude deleted" ON public.table_name
  FOR SELECT
  USING (deleted_at IS NULL AND tenant_id = ...);
```

### Updated Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_name_updated_at
  BEFORE UPDATE ON public.table_name
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### UUID References
```sql
-- ✅ Always use uuid type for foreign keys
customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE

-- ✅ Use gen_random_uuid() for defaults
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

## Checklist Before Migration

- [ ] Table has `tenant_id` column with foreign key
- [ ] RLS is enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] RLS policies filter by `tenant_id`
- [ ] Security definer functions have `SET search_path = public`
- [ ] Proper indexes on foreign keys and filter columns
- [ ] Timestamps use `timestamptz` not `timestamp`
