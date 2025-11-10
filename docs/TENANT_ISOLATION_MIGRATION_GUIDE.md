# Tenant Isolation Migration Guide

This guide helps you migrate existing code to use the new tenant isolation system.

## Quick Migration Checklist

- [ ] Replace direct Supabase queries with `tenantQuery` helpers
- [ ] Add tenant validation to all Edge Functions
- [ ] Update React Query keys to include `tenant_id`
- [ ] Verify all routes use `TenantAdminProtectedRoute`
- [ ] Test cross-tenant access is blocked

## Step 1: Replace Direct Queries

### Before (❌ Wrong)
```typescript
// ❌ Missing tenant_id filter - data leak risk!
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('status', 'active');
```

### After (✅ Correct)
```typescript
import { tenantQuery } from '@/lib/utils/tenantQueries';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const { tenant } = useTenantAdminAuth();

// ✅ Tenant-scoped query
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('status', 'active');
```

## Step 2: Update React Query Hooks

### Before (❌ Wrong)
```typescript
const { data: products } = useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const { data } = await supabase.from('products').select('*');
    return data;
  },
});
```

### After (✅ Correct)
```typescript
import { queryKeys } from '@/lib/queryKeys';
import { tenantQuery } from '@/lib/utils/tenantQueries';

const { tenant } = useTenantAdminAuth();

const { data: products } = useQuery({
  queryKey: queryKeys.products.list(tenant.id), // ✅ Includes tenant_id
  queryFn: async () => {
    const { data } = await tenantQuery(supabase, 'products', tenant.id)
      .select('*');
    return data;
  },
  enabled: !!tenant?.id, // ✅ Only run when tenant is loaded
});
```

## Step 3: Update Edge Functions

### Before (❌ Wrong)
```typescript
serve(async (req) => {
  const body = await req.json();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', body.productId); // ❌ Missing tenant validation
});
```

### After (✅ Correct)
```typescript
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { validateTenantAccess } from "@/lib/utils/tenantQueries"; // Note: This won't work in Edge Functions directly

const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const rawBody = await req.json();
    const body = RequestSchema.parse(rawBody);

    // Extract user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Validate tenant access
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", body.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized tenant access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ All queries filter by tenant_id
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", body.product_id)
      .eq("tenant_id", body.tenant_id); // ✅ Required!

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Error handling...
  }
});
```

## Step 4: Update Mutations

### Before (❌ Wrong)
```typescript
const createProduct = async (productData: ProductData) => {
  const { data } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single();
  return data;
};
```

### After (✅ Correct)
```typescript
import { tenantInsert } from '@/lib/utils/tenantQueries';

const createProduct = async (productData: ProductData) => {
  const { tenant } = useTenantAdminAuth();
  
  const { data } = await tenantInsert(supabase, 'products', tenant.id)
    .insert({ ...productData, tenant_id: tenant.id })
    .select()
    .single();
  return data;
};
```

## Step 5: Update Route Protection

### Before (❌ Wrong)
```typescript
<Route
  path="/admin/products"
  element={<ProductManagement />}
/>
```

### After (✅ Correct)
```typescript
import { TenantAdminProtectedRoute } from '@/components/auth/TenantAdminProtectedRoute';

<Route
  path="/:tenantSlug/admin/products"
  element={
    <TenantAdminProtectedRoute>
      <ProductManagement />
    </TenantAdminProtectedRoute>
  }
/>
```

## Common Patterns

### Pattern 1: List with Filters
```typescript
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false });
```

### Pattern 2: Get Single Item
```typescript
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('id', productId)
  .single();
```

### Pattern 3: Count
```typescript
const { count } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active');
```

### Pattern 4: Update
```typescript
const { data } = await tenantUpdate(supabase, 'products', tenant.id)
  .update({ name: 'New Name' })
  .eq('id', productId)
  .select()
  .single();
```

### Pattern 5: Delete
```typescript
await tenantDelete(supabase, 'products', tenant.id)
  .eq('id', productId);
```

## Testing Tenant Isolation

### Test 1: Verify Cross-Tenant Access is Blocked
```typescript
// Create two test tenants
const tenantA = await createTestTenant();
const tenantB = await createTestTenant();

// Create products for each
await createTestProduct(tenantA.id);
await createTestProduct(tenantB.id);

// Login as tenant A user
const userA = await loginAsTenantUser(tenantA.id);

// Try to query - should only see tenant A products
const { data } = await tenantQuery(supabase, 'products', tenantA.id)
  .select('*');

expect(data?.every(p => p.tenant_id === tenantA.id)).toBe(true);
expect(data?.some(p => p.tenant_id === tenantB.id)).toBe(false);
```

### Test 2: Verify Edge Function Validation
```typescript
// Try to access tenant B data with tenant A credentials
const response = await fetch('/api/products', {
  headers: {
    Authorization: `Bearer ${tenantAUserToken}`,
  },
  body: JSON.stringify({
    tenant_id: tenantB.id, // ❌ Wrong tenant
    product_id: tenantBProductId,
  }),
});

expect(response.status).toBe(403);
```

## Migration Script

Use this script to find queries that need migration:

```bash
#!/bin/bash
# find-queries-needing-migration.sh

echo "🔍 Finding queries that need tenant isolation migration..."

# Find .from() calls without tenant_id
grep -r "\.from(" src/ --include="*.ts" --include="*.tsx" | \
  grep -v "tenantQuery\|tenant\.id\|tenantId\|tenant_id" | \
  grep -v "node_modules" | \
  grep -v "\.test\." | \
  grep -v "\.spec\."

echo ""
echo "✅ Migration candidates found above"
echo "Replace with tenantQuery() helper"
```

## Quick Reference

| Old Pattern | New Pattern |
|------------|------------|
| `supabase.from('table').select('*')` | `tenantQuery(supabase, 'table', tenant.id).select('*')` |
| `supabase.from('table').insert(data)` | `tenantInsert(supabase, 'table', tenant.id).insert({...data, tenant_id})` |
| `supabase.from('table').update(data)` | `tenantUpdate(supabase, 'table', tenant.id).update(data)` |
| `supabase.from('table').delete()` | `tenantDelete(supabase, 'table', tenant.id).delete()` |
| `['products']` (query key) | `queryKeys.products.list(tenant.id)` |
| No tenant validation in Edge Functions | Validate with `tenant_users` table check |

## Need Help?

- See [Tenant Isolation Documentation](./TENANT_ISOLATION.md) for complete guide
- See [Admin Panel Rules](./ADMIN_PANEL_RULES.md) for admin-specific patterns
- See [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) for database patterns

