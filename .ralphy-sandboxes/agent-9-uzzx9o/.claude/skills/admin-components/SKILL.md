---
name: admin-components
description: FloraIQ admin panel component patterns. Use when building admin UI, hub pages, permission-gated features, or tenant-aware components. Includes hub architecture, TanStack Query patterns, and shadcn/ui integration.
---

# Admin Components Skill

## Hub Architecture

FloraIQ admin has 12 specialized hubs. Each hub follows this structure:

```tsx
import { HubBreadcrumbs } from '@/components/admin/navigation/HubBreadcrumbs';

export function ProductsHub() {
  const { tenant } = useTenantAdminAuth();
  
  return (
    <div className="p-6">
      <HubBreadcrumbs
        items={[
          { label: 'Admin', href: `/${tenant?.slug}/admin` },
          { label: 'Products' }
        ]}
      />
      <HubHeader title="Products Hub" />
      <HubTabs tabs={productsTabs} />
    </div>
  );
}
```

### Tab Ordering Convention
1. **Overview** - Always first
2. **Core Functions** - Main CRUD operations  
3. **Analytics/Reports** - Data views
4. **Settings/Config** - Always last

## Component Template

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types';

interface ProductListProps {
  categoryId?: string;
  onSelect?: (product: Product) => void;
}

export function ProductList({ categoryId, onSelect }: ProductListProps) {
  const { tenant } = useTenantAdminAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  // Tenant-aware query
  const { data: products, isLoading, error } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id, categoryId),
    queryFn: async () => {
      const query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant!.id);
      
      if (categoryId) {
        query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Failed to load products</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {products?.map((product) => (
        <Card key={product.id} onClick={() => onSelect?.(product)}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
```

## Required Hooks

### Tenant Context
```typescript
// ✅ ALWAYS use for tenant access
const { tenant, user, isAdmin, tenantSlug } = useTenantAdminAuth();

// ✅ Guard early if no tenant
if (!tenant) return <LoadingSpinner />;
```

### Permissions
```typescript
const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

// Single permission check
if (!hasPermission('manage_products')) {
  return <AccessDenied />;
}

// Multiple permissions
if (!hasAnyPermission(['view_orders', 'manage_orders'])) {
  return null;
}
```

### Feature Access (Subscription Tier)
```typescript
const { hasAccess, isLoading } = useFeatureAccess('advanced_analytics');

if (!hasAccess) {
  return <UpgradePrompt feature="advanced_analytics" />;
}
```

## Mutation Pattern

```typescript
const queryClient = useQueryClient();
const { tenant } = useTenantAdminAuth();

const createProduct = useMutation({
  mutationFn: async (newProduct: CreateProductInput) => {
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...newProduct,
        tenant_id: tenant!.id,  // Always include tenant_id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    toast.success('Product created successfully');
  },
  onError: (error) => {
    logger.error('Failed to create product', { error });
    toast.error('Failed to create product');
  },
});

// Usage
<Button 
  onClick={() => createProduct.mutate(formData)}
  disabled={createProduct.isPending}
>
  {createProduct.isPending ? 'Creating...' : 'Create Product'}
</Button>
```

## Navigation Pattern

```typescript
import { useNavigate } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function ProductActions({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const { tenantSlug } = useTenantAdminAuth();

  const handleEdit = () => {
    // ✅ Always include tenant slug
    navigate(`/${tenantSlug}/admin/products/${productId}/edit`);
  };

  return <Button onClick={handleEdit}>Edit</Button>;
}
```

## Component Checklist

- [ ] Uses `useTenantAdminAuth()` for tenant context
- [ ] Queries filter by `tenant_id`
- [ ] Has loading skeleton state
- [ ] Has error state with user-friendly message
- [ ] Mutations include `tenant_id`
- [ ] Uses `queryKeys` factory
- [ ] Invalidates queries on mutations
- [ ] Uses `logger` not `console.log`
- [ ] Navigation includes tenant slug
- [ ] Buttons disabled during loading
