# Tenant Isolation - Quick Start Guide

Get started with tenant isolation in 5 minutes.

## 🚀 Quick Setup

### 1. Run the Migration

```bash
supabase migration up 20250130000000_complete_tenant_isolation
```

This will:
- Create helper functions
- Add automatic tenant creation trigger
- Ensure all tables have `tenant_id` and RLS
- Create tenant isolation policies

### 2. Import the Utilities

```typescript
import { tenantQuery, tenantInsert, tenantUpdate, tenantDelete } from '@/lib/utils/tenantQueries';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
```

### 3. Use in Your Components

```typescript
function ProductList() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: products } = useQuery({
    queryKey: ['products', tenant.id],
    queryFn: async () => {
      const { data } = await tenantQuery(supabase, 'products', tenant.id)
        .select('*');
      return data;
    },
    enabled: !!tenant?.id,
  });

  return <div>{/* Render products */}</div>;
}
```

## 📋 Common Patterns

### List Items
```typescript
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('status', 'active');
```

### Get Single Item
```typescript
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*')
  .eq('id', productId)
  .single();
```

### Create Item
```typescript
const { data } = await tenantInsert(supabase, 'products', tenant.id)
  .insert({ name: 'Product', price: 100, tenant_id: tenant.id })
  .select()
  .single();
```

### Update Item
```typescript
const { data } = await tenantUpdate(supabase, 'products', tenant.id)
  .update({ name: 'Updated Name' })
  .eq('id', productId)
  .select()
  .single();
```

### Delete Item
```typescript
await tenantDelete(supabase, 'products', tenant.id)
  .eq('id', productId);
```

## ✅ Checklist

Before pushing code, verify:

- [ ] All queries use `tenantQuery()` helper
- [ ] All mutations use `tenantInsert/Update/Delete()` helpers
- [ ] React Query keys include `tenant.id`
- [ ] Edge Functions validate tenant access
- [ ] Routes use `TenantAdminProtectedRoute`
- [ ] No direct `supabase.from()` calls without tenant filter

## 🛠️ Need More Examples?

See `src/lib/utils/tenantQueries.examples.ts` for complete working examples.

## 📚 Full Documentation

- [Complete Guide](./TENANT_ISOLATION.md)
- [Migration Guide](./TENANT_ISOLATION_MIGRATION_GUIDE.md)
- [Rules Compliance](./TENANT_ISOLATION_RULES_COMPLIANCE.md)

