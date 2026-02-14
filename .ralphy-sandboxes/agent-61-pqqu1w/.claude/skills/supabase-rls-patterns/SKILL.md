---
name: supabase-rls-patterns
description: Row Level Security policy patterns for multi-tenant Supabase applications. Tenant isolation, role-based access, and security definer functions.
---

# Supabase RLS Patterns

Security patterns for multi-tenant applications.

## Tenant Isolation Pattern

### Basic Tenant Policy

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON products
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### With Role-Based Access

```sql
-- Users can view within their tenant
CREATE POLICY "tenant_read" ON products
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Only admins can modify
CREATE POLICY "admin_modify" ON products
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'role') = 'admin'
  );
```

## Common Policy Patterns

### Owner-Only Access

```sql
CREATE POLICY "owner_only" ON user_settings
  FOR ALL
  USING (user_id = auth.uid());
```

### Public Read, Owner Write

```sql
-- Anyone can read published items
CREATE POLICY "public_read" ON blog_posts
  FOR SELECT
  USING (status = 'published');

-- Only owner can modify
CREATE POLICY "owner_write" ON blog_posts
  FOR ALL
  USING (author_id = auth.uid());
```

### Hierarchical Access

```sql
-- Manager can see their team's data
CREATE POLICY "manager_access" ON employee_data
  FOR SELECT
  USING (
    manager_id = auth.uid()
    OR user_id = auth.uid()
  );
```

## Security Definer Functions

### Pattern Template

```sql
CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- CRITICAL: Prevent search path injection
AS $$
DECLARE
  result json;
BEGIN
  -- Verify caller has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE tenant_id = p_tenant_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Perform privileged operation
  SELECT json_build_object(
    'total_orders', COUNT(*),
    'total_revenue', SUM(total)
  ) INTO result
  FROM orders
  WHERE tenant_id = p_tenant_id;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_tenant_stats TO authenticated;
```

## Testing RLS Policies

### Verify Tenant Isolation

```sql
-- Test as specific user
SET request.jwt.claim.tenant_id = 'tenant-uuid-here';
SET request.jwt.claim.sub = 'user-uuid-here';

-- Should only return rows for that tenant
SELECT * FROM products;

-- Reset
RESET request.jwt.claim.tenant_id;
RESET request.jwt.claim.sub;
```

### Common Mistakes

| Mistake | Why It's Dangerous | Fix |
|---------|-------------------|-----|
| Missing `SET search_path` | Search path injection attacks | Always include in SECURITY DEFINER |
| `FOR ALL` without tenant check | Cross-tenant data access | Always filter by tenant_id |
| No policy on junction tables | Leak relationships | Add policies to ALL tables |
| Using `text` for tenant_id | Case sensitivity issues | Use `uuid` type |

## Policy Naming Convention

```
{table}_{action}_{scope}

Examples:
- products_select_tenant
- products_all_admin
- orders_insert_authenticated
- analytics_select_manager
```

## Debugging Policies

```sql
-- Check which policies apply
SELECT * FROM pg_policies WHERE tablename = 'products';

-- Test policy evaluation
EXPLAIN (FORMAT TEXT, COSTS OFF)
SELECT * FROM products WHERE id = 'some-id';
```
