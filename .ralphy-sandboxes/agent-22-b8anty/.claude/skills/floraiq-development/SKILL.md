---
name: floraiq-development
description: FloraIQ Smart Cannabis Operations Platform development patterns. Multi-tenant React 18 + TypeScript + Supabase with TanStack Query, shadcn/ui, and tenant-aware routing.
---

# FloraIQ Development Skill

## Project Overview

FloraIQ is a comprehensive full-stack PWA combining delivery services, wholesale CRM, multi-tenant SAAS, and advanced inventory management.

**Tech Stack:**
- **Frontend:** React 18 + TypeScript + Vite 5.0
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query (React Query)
- **Routing:** React Router v6
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Forms:** React Hook Form + Zod

## Critical Rules

### Auto-Generated Files (NEVER EDIT)
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml` (project_id line)
- `.env`

### Logging
```typescript
// ✅ ALWAYS use logger
import { logger } from '@/lib/logger';
logger.debug('context', { data });

// ❌ NEVER use console.log in frontend
```

### Storage
```typescript
// ✅ ALWAYS use STORAGE_KEYS
import { STORAGE_KEYS } from '@/constants/storageKeys';
// ✅ ALWAYS wrap in try-catch
// ✅ Use useLocalStorage hook in components
```

### Database
- Use `.maybeSingle()` instead of `.single()` for optional data
- SECURITY DEFINER functions MUST have `SET search_path = public`
- All tables MUST have RLS enabled
- Multi-tenant tables filter by `tenant_id` in RLS

### TypeScript
- Use `@/` alias for all imports
- NEVER use `any` type (use `unknown` if necessary)
- ALWAYS define interfaces for component props
- Import order: React → Third-party → Types → Components → Utils

### TanStack Query
```typescript
// ✅ Use queryKeys factory
import { queryKeys } from '@/lib/queryKeys';

const { data } = useQuery({
  queryKey: queryKeys.products.list(tenantId),
  queryFn: () => fetchProducts(tenantId),
});

// ✅ Invalidate on mutations
queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
```

### Admin Panel Patterns
```typescript
// ✅ ALWAYS use tenant context
const { tenant, user } = useTenantAdminAuth();

// ✅ ALWAYS filter by tenant_id
const { data } = useQuery({
  queryKey: ['products', tenant?.id],
  queryFn: () => supabase.from('products')
    .select('*')
    .eq('tenant_id', tenant?.id),
  enabled: !!tenant?.id,
});

// ✅ Permission-based UI
const { hasPermission } = usePermissions();
if (!hasPermission('manage_products')) return null;
```

### Navigation
```typescript
// ✅ Include tenant slug in admin routes
navigate(`/${tenantSlug}/admin/products`);

// ✅ Use Link components for internal nav
<Link to={`/${tenantSlug}/admin/orders`}>Orders</Link>

// ❌ NEVER use window.location or hardcoded /admin/
```

## Project Structure

```
src/
├── pages/
│   ├── saas/           # Multi-tenant SAAS
│   ├── admin/          # Admin panel
│   ├── customer/       # Customer-facing
│   └── mobile/         # Mobile/runner
├── components/
│   ├── admin/          # Admin components
│   ├── shop/           # Storefront
│   └── ui/             # shadcn/ui + custom
├── hooks/              # Custom hooks (useXxx.ts)
├── lib/                # Utilities
└── contexts/           # React contexts

supabase/
├── functions/          # Edge Functions
└── migrations/         # Database migrations
```

## Common Workflows

### Creating a New Admin Page
1. Create page in `src/pages/admin/NewPage.tsx`
2. Add route in `App.tsx` with `TenantAdminProtectedRoute`
3. Add to navigation in `src/lib/constants/navigation.ts`
4. Use `useTenantAdminAuth()` for tenant context

### Adding a Database Table
1. Create migration in `supabase/migrations/`
2. Add RLS policies with tenant_id filter
3. Regenerate types (auto-generated)
4. Create hooks in `src/hooks/`

### Creating React Component
```typescript
// ✅ Template
import { useState } from 'react';
import { logger } from '@/lib/logger';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onSelect?: (id: string) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  // Component implementation
}
```

## Before Every Commit
- [ ] No `console.log` (use `logger`)
- [ ] No `@ts-nocheck` or `any` types
- [ ] No hardcoded `/admin/` routes
- [ ] Error handling with try-catch
- [ ] Loading states for async operations
- [ ] Tenant-aware queries filter by `tenant_id`
