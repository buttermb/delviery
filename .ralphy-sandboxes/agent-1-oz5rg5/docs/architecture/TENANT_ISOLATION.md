# Complete Tenant Isolation System

## Overview

This document describes the complete tenant isolation system that ensures each customer gets their own fully isolated admin panel with no data overlap or leaks between business accounts.

## Architecture

### 1. Automatic Tenant Creation

When a new customer signs up, the system automatically:

1. **Generates a unique `tenant_id` (UUID)**
2. **Creates tenant record** in `public.tenants` table with:
   - Business metadata (name, slug, owner info)
   - Subscription plan (default: 'starter')
   - Trial period (14 days)
   - Default limits and features
3. **Links user to tenant** in `public.tenant_users` with role = 'owner'
4. **Creates default feature/limit rows** in tenant configuration

#### Primary Method: Edge Function

The `tenant-signup` Edge Function (`supabase/functions/tenant-signup/index.ts`) handles tenant creation during signup. This is the **primary** method.

#### Fallback Method: Database Trigger

A database trigger (`handle_new_user_tenant_creation`) automatically creates a tenant if a user signs up through other means (e.g., direct Supabase Auth signup). This is a **safety net**.

### 2. Tenant Isolation Enforcement

#### Database Level (RLS Policies)

Every table containing user/business/customer data has:

1. **`tenant_id` column** - Foreign key to `public.tenants(id)`
2. **Row Level Security (RLS) enabled**
3. **Tenant isolation policy**:

```sql
CREATE POLICY "tenant_isolation_table_name"
  ON table_name FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
  );
```

#### Application Level (Query Helpers)

Use tenant-aware query helpers instead of direct Supabase queries:

```typescript
import { tenantQuery } from '@/lib/utils/tenantQueries';

// ❌ WRONG - No tenant filter
const { data } = await supabase.from('products').select('*');

// ✅ CORRECT - Tenant-scoped
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('status', 'active');
```

#### Edge Function Level

All Edge Functions must:

1. **Validate `tenant_id`** from JWT token or request body
2. **Verify tenant access** using `validateTenantAccess()`
3. **Filter all queries** by `tenant_id`
4. **Return 403** if tenant_id doesn't belong to user

```typescript
// Extract user from JWT
const { data: { user } } = await supabase.auth.getUser(token);

// Validate tenant access
const hasAccess = await validateTenantAccess(
  supabase,
  user.id,
  body.tenant_id
);

if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: "Unauthorized tenant access" }),
    { status: 403, headers: corsHeaders }
  );
}

// All queries must filter by tenant_id
const { data } = await supabase
  .from("products")
  .select("*")
  .eq("tenant_id", body.tenant_id);  // ✓ Required!
```

### 3. Admin Panel Routing

Each tenant gets their own isolated admin panel route:

```
/:tenantSlug/admin/*
```

**Route Protection:**

```typescript
<Route
  path="/:tenantSlug/admin/*"
  element={
    <TenantAdminProtectedRoute>
      <AdminPanelRoutes />
    </TenantAdminProtectedRoute>
  }
/>
```

**Tenant Context:**

```typescript
const { tenant, admin } = useTenantAdminAuth();

// All queries use tenant.id
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*');
```

**URL Validation:**

The `TenantAdminProtectedRoute` component:
1. Extracts `tenantSlug` from URL
2. Validates it matches user's tenant
3. Redirects to 403 if mismatch

### 4. Query Key Factory (TanStack Query)

All React Query keys include `tenant_id`:

```typescript
import { queryKeys } from '@/lib/queryKeys';

// Query key includes tenant_id
const { data } = useQuery({
  queryKey: queryKeys.products.list(tenant.id),
  queryFn: async () => {
    const { data } = await tenantQuery(supabase, 'products', tenant.id)
      .select('*');
    return data;
  },
  enabled: !!tenant?.id,
});
```

## Helper Functions

### Database Functions

```sql
-- Get user's tenant IDs (array)
SELECT * FROM get_user_tenant_ids();

-- Check if user belongs to tenant
SELECT user_belongs_to_tenant('tenant-uuid-here');

-- Get primary tenant ID
SELECT get_user_tenant_id();
```

### TypeScript Utilities

```typescript
import {
  tenantQuery,
  tenantInsert,
  tenantUpdate,
  tenantDelete,
  validateTenantAccess,
  getUserTenantIds,
  hasTenantId,
  assertTenantId,
} from '@/lib/utils/tenantQueries';

// Query
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*');

// Insert
await tenantInsert(supabase, 'products', tenant.id)
  .insert({ name: 'Product', ... });

// Update
await tenantUpdate(supabase, 'products', tenant.id)
  .update({ name: 'Updated' })
  .eq('id', productId);

// Delete
await tenantDelete(supabase, 'products', tenant.id)
  .eq('id', productId);

// Validate access (Edge Functions)
const hasAccess = await validateTenantAccess(supabase, userId, tenantId);
```

## Pre-Push Validation

The pre-push hook automatically checks for:

1. ✅ Queries missing `tenant_id` filter (warns if not using `tenantQuery`)
2. ✅ Edge functions missing tenant validation
3. ✅ RLS policies missing tenant isolation
4. ✅ Tables missing `tenant_id` column

## Migration: Complete Tenant Isolation

Run the migration to ensure all tables have proper isolation:

```bash
supabase migration up 20250130000000_complete_tenant_isolation
```

This migration:
- Creates helper functions
- Adds automatic tenant creation trigger
- Ensures all tables have `tenant_id` and RLS
- Creates tenant isolation policies

## Testing Tenant Isolation

### Manual Testing

1. **Create two test tenants:**
   ```sql
   INSERT INTO tenants (business_name, slug, owner_email, owner_name, ...) VALUES (...);
   ```

2. **Create users for each tenant:**
   ```sql
   INSERT INTO tenant_users (tenant_id, user_id, email, role, status) VALUES (...);
   ```

3. **Verify isolation:**
   - Login as user from tenant A
   - Try to access data from tenant B
   - Should return empty results or 403

### Automated Testing

```typescript
describe('Tenant Isolation', () => {
  it('should not allow cross-tenant data access', async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();
    
    const userA = await createTestUser(tenantA.id);
    const userB = await createTestUser(tenantB.id);
    
    // User A should only see tenant A data
    const { data: productsA } = await tenantQuery(
      supabase,
      'products',
      tenantA.id
    ).select('*');
    
    // Should not include tenant B products
    expect(productsA?.every(p => p.tenant_id === tenantA.id)).toBe(true);
  });
});
```

## Common Mistakes to Avoid

### ❌ Direct Queries Without Tenant Filter

```typescript
// ❌ WRONG - Data leak risk!
const { data } = await supabase.from('products').select('*');
```

### ❌ Skipping Tenant Validation in Edge Functions

```typescript
// ❌ WRONG - Security risk!
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('id', productId);  // Missing tenant_id check!
```

### ❌ Hardcoding Tenant ID

```typescript
// ❌ WRONG - Not dynamic!
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', 'hardcoded-uuid');
```

### ❌ Using localStorage for Tenant Context

```typescript
// ❌ WRONG - Can be manipulated!
const tenantId = localStorage.getItem('tenant_id');
```

## Best Practices

1. ✅ **Always use `tenantQuery` helpers** for frontend queries
2. ✅ **Always validate tenant access** in Edge Functions
3. ✅ **Always include `tenant_id` in query keys** (TanStack Query)
4. ✅ **Always use `useTenantAdminAuth()`** for tenant context
5. ✅ **Always filter by `tenant.id`** in all queries
6. ✅ **Always test cross-tenant access** is blocked

## Troubleshooting

### Issue: User can see other tenant's data

**Check:**
1. RLS policies are enabled on the table
2. RLS policy includes tenant isolation check
3. Query includes `.eq('tenant_id', tenant.id)`
4. Edge Function validates tenant access

### Issue: New user doesn't get tenant

**Check:**
1. `tenant-signup` Edge Function is called
2. Database trigger is enabled
3. `tenant_users` record is created
4. User has `status = 'active'`

### Issue: 403 errors on valid requests

**Check:**
1. `tenant_id` matches user's tenant
2. User has `status = 'active'` in `tenant_users`
3. RLS policy allows access
4. Edge Function validates correctly

## Related Documentation

- [Admin Panel Rules](./ADMIN_PANEL_RULES.md) - Admin panel specific rules
- [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) - Database patterns
- [Supabase Rules](./SUPABASE_RULES.md) - Supabase-specific rules

