# Business Admin Panel - Complete Rules & Best Practices

## 🔐 1. Authentication & Context (CRITICAL)

### TenantAdminAuthContext Rules

```typescript
// ✅ ALWAYS use useTenantAdminAuth hook
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const { admin, tenant, loading, token, accessToken } = useTenantAdminAuth();
```

**CRITICAL RULES:**

- ❌ **NEVER** check admin status using `localStorage` directly
- ❌ **NEVER** use hardcoded credentials or client-side role checks
- ✅ **ALWAYS** use `useTenantAdminAuth()` hook to get current admin & tenant
- ✅ **ALWAYS** check `loading` state before rendering admin content
- ✅ **ALWAYS** use `accessToken` for Edge Function authorization headers
- ✅ **ALWAYS** validate tenant slug matches URL path

```typescript
// ❌ WRONG - Never do this!
const isAdmin = localStorage.getItem('isAdmin') === 'true';

// ✅ CORRECT - Use context
const { admin, tenant, loading } = useTenantAdminAuth();

if (loading) return <LoadingSpinner />;
if (!admin) return <Navigate to="/login" />;
```

---

## 🎭 2. Role-Based Permissions (CRITICAL)

### Permission System Rules

```typescript
// ✅ ALWAYS use usePermissions hook
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/lib/constants/permissions';

const { role, checkPermission, checkAnyPermission, checkAllPermissions } = usePermissions();
```

**CRITICAL RULES:**

- ✅ **ALWAYS** store roles in separate `user_roles` table (NEVER in `profiles` or `auth.users`)
- ✅ **ALWAYS** use `SECURITY DEFINER` function for role checks (prevents RLS recursion)
- ✅ **ALWAYS** check permissions before showing UI elements
- ✅ **ALWAYS** check permissions in Edge Functions (server-side validation)
- ✅ Use `PermissionGuard` component for conditional rendering

**Valid Roles:**

```typescript
type Role = 'owner' | 'manager' | 'runner' | 'warehouse' | 'viewer';
```

**Permission Categories:**

- `orders:*` - view, create, edit, delete, cancel
- `inventory:*` - view, edit, transfer, receive, delete
- `transfers:*` - view, create, edit, assign, complete
- `menus:*` - view, create, edit, burn, delete
- `customers:*` - view, create, edit, delete
- `products:*` - view, create, edit, delete
- `finance:*` - view, edit, payments, credit, reports
- `team:*` - view, create, edit, delete
- `settings:*` - view, edit, security, integrations
- `reports:*` - view, export

```typescript
// ✅ EXAMPLE: Conditional rendering based on permission
<PermissionGuard permission="orders:create">
  <Button onClick={handleCreateOrder}>Create Order</Button>
</PermissionGuard>

// ✅ EXAMPLE: Multiple permissions (any)
<PermissionGuard permissions={['orders:create', 'orders:edit']} requireAll={false}>
  <OrderActions />
</PermissionGuard>

// ✅ EXAMPLE: Programmatic check
if (checkPermission('finance:reports')) {
  // Show financial reports
}
```

---

## 🏢 3. Tenant Isolation (CRITICAL)

### Multi-Tenant Rules

```typescript
// ✅ ALWAYS filter by tenant_id in queries
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

const { tenant } = useTenantAdminAuth();

// ✅ CORRECT - Filter by tenant
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', tenant.id);

// ❌ WRONG - Missing tenant filter (data leak!)
const { data } = await supabase.from('products').select('*');
```

**CRITICAL RULES:**

- ✅ **ALL** database queries MUST filter by `tenant.id`
- ✅ **ALL** RLS policies MUST include `tenant_id` check
- ✅ **ALL** Edge Functions MUST validate tenant context
- ✅ **ALWAYS** validate tenant slug from URL matches stored tenant
- ❌ **NEVER** allow cross-tenant data access

```typescript
// ✅ EXAMPLE: Safe query helper
const safeQuery = (table: string) => {
  return supabase.from(table).select('*').eq('tenant_id', tenant.id);
};
```

---

## 💎 4. Feature Access & Subscription Tiers (CRITICAL)

### Tier-Based Feature Access Rules

```typescript
// ✅ ALWAYS use useFeatureAccess hook
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const { currentTier, canAccess, checkUpgrade } = useFeatureAccess();
```

**Subscription Tiers:**

- **Starter ($99/mo)**: 12 features (Dashboard, Products, Menus, Customers, Basic Orders, Settings, Billing, Help, Barcodes, Wholesale Orders, Reports, Inventory)
- **Professional ($299/mo)**: 31 features (+19: Analytics, Live Orders, Team, Advanced Inventory, Financial)
- **Enterprise ($600/mo)**: 56 features (+25: Fleet, Delivery, POS, Locations, API, Webhooks, AI, White Label)

**CRITICAL RULES:**

- ✅ **ALWAYS** check feature access before showing UI
- ✅ **ALWAYS** use `FeatureProtectedRoute` wrapper for routes
- ✅ **ALWAYS** validate feature access in Edge Functions
- ✅ Show upgrade prompts when feature is locked

```typescript
// ✅ EXAMPLE: Feature-protected route
<FeatureProtectedRoute featureId="api-access">
  <ApiAccessPage />
</FeatureProtectedRoute>

// ✅ EXAMPLE: Conditional rendering
if (canAccess('api-access')) {
  return <ApiAccessPage />;
} else {
  const upgrade = checkUpgrade('api-access');
  return <UpgradePrompt requiredTier={upgrade.requiredTier} />;
}
```

---

## 📊 5. Resource Limits (CRITICAL)

### Plan Limit Rules

```typescript
// ✅ ALWAYS use useTenantLimits hook
import { useTenantLimits } from '@/hooks/useTenantLimits';

const { canCreate, getRemaining, getCurrent, getLimit } = useTenantLimits();
```

**Resource Types:**

- `customers` - Customer records
- `menus` - Disposable menus
- `products` - Product catalog
- `locations` - Physical locations
- `users` - Team members

**CRITICAL RULES:**

- ✅ **ALWAYS** check `canCreate(resource)` before allowing creation
- ✅ **ALWAYS** use `checkLimit()` from `src/lib/tenant.ts` (single source of truth)
- ✅ **ALWAYS** show limit warnings at 80% usage
- ✅ Enterprise plans: `-1` = unlimited
- ✅ Show upgrade prompts when limits reached

```typescript
// ✅ EXAMPLE: Check before creation
const handleCreateProduct = async () => {
  if (!canCreate('products')) {
    const remaining = getRemaining('products');
    toast.error(`Product limit reached! ${getCurrent('products')}/${getLimit('products')} used`);
    return;
  }
  // Proceed with creation
  await createProduct();
};

// ✅ EXAMPLE: Show limit status
<Card>
  <CardContent>
    {getCurrent('products')} / {getLimit('products') === Infinity ? '∞' : getLimit('products')} Products
  </CardContent>
</Card>
```

---

## 🎯 6. Component & Hook Usage Rules

### Standard Hooks

```typescript
// ✅ ALWAYS use these hooks in admin panel
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useAdminKeyboardShortcuts } from '@/hooks/useAdminKeyboardShortcuts';
```

### Standard Components

```typescript
// ✅ ALWAYS use these for consistency
import { PermissionGuard } from '@/components/admin/PermissionGuard';
import { FeatureProtectedRoute } from '@/components/auth/FeatureProtectedRoute';
import { TenantAdminProtectedRoute } from '@/components/auth/TenantAdminProtectedRoute';
import { StatusBadge } from '@/components/admin/reusable/StatusBadge';
import { DataTable } from '@/components/admin/reusable/DataTable';
import { PageHeader } from '@/components/admin/reusable/PageHeader';
```

---

## 🚀 7. Edge Function Calls (CRITICAL)

### Admin Edge Function Rules

```typescript
// ✅ ALWAYS use adminFunctionHelper
import { callAdminFunction } from '@/utils/adminFunctionHelper';
import { adminApiCall } from '@/utils/adminApiClient';
```

**CRITICAL RULES:**

- ✅ **ALWAYS** pass `accessToken` in Authorization header
- ✅ **ALWAYS** use centralized error handling helpers
- ✅ **ALWAYS** validate tenant_id in Edge Function
- ✅ **ALWAYS** wrap with `withZenProtection` middleware
- ✅ **ALWAYS** use Zod validation for inputs

```typescript
// ✅ EXAMPLE: Call admin Edge Function
const { data, error } = await callAdminFunction({
  functionName: 'admin-dashboard',
  body: { endpoint: 'stats', tenant_id: tenant.id },
  session: { access_token: accessToken },
  errorMessage: 'Failed to load dashboard data',
});

// ✅ EXAMPLE: Admin API operations
const { data, error } = await adminApiCall({
  resource: 'api_keys',
  action: 'list',
});
```

---

## 🧭 8. Navigation & Routing Rules

### Admin Route Structure

```
/:tenantSlug/admin/
├── dashboard              (Starter)
├── disposable-menus       (Starter)
├── big-plug-clients       (Starter - Customers)
├── inventory/
│   ├── products           (Starter)
│   └── advanced-inventory (Professional)
├── menu-analytics         (Professional)
├── team-members           (Professional)
├── fleet-management       (Enterprise)
├── api-access             (Enterprise)
├── settings               (Starter)
└── billing                (Starter)
```

**CRITICAL RULES:**

- ✅ **ALL** admin routes MUST start with `/:tenantSlug/admin/`
- ✅ **ALWAYS** wrap with `TenantAdminProtectedRoute`
- ✅ **ALWAYS** wrap with `FeatureProtectedRoute` for tier-locked features
- ✅ **ALWAYS** validate tenant slug from URL
- ✅ Use `useParams()` to get `tenantSlug`

```typescript
// ✅ EXAMPLE: Protected admin route
<Route
  path="/:tenantSlug/admin/dashboard"
  element={
    <TenantAdminProtectedRoute>
      <FeatureProtectedRoute featureId="dashboard">
        <DashboardPage />
      </FeatureProtectedRoute>
    </TenantAdminProtectedRoute>
  }
/>
```

---

## 📦 9. State Management Rules

### TanStack Query Rules

```typescript
// ✅ ALWAYS use query key factory
import { queryKeys } from '@/lib/queryKeys';

// ✅ EXAMPLE: Query with tenant context
const { data: products } = useQuery({
  queryKey: queryKeys.products.list(tenant.id),
  queryFn: async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant.id);
    return data;
  },
  enabled: !!tenant?.id,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## 🛡️ 10. Error Handling Rules

### Admin Error Handling

```typescript
// ✅ ALWAYS use structured error handling
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

try {
  const result = await someOperation();
  toast.success('Operation completed');
} catch (error: unknown) {
  logger.error('Operation failed', error, { component: 'ComponentName' });
  toast.error('Operation failed', {
    description: error instanceof Error ? error.message : 'Unknown error',
  });
}
```

**CRITICAL RULES:**

- ❌ **NEVER** use `console.log` (use `logger`)
- ✅ **ALWAYS** log errors with component context
- ✅ **ALWAYS** show user-friendly error messages
- ✅ **ALWAYS** use `toast` for user feedback

---

## 📝 11. TypeScript Rules

```typescript
// ✅ ALWAYS use defined types
import type { Product } from '@/types/product';
import type { Order } from '@/types/order';

// ✅ ALWAYS define props interfaces
interface ProductCardProps {
  product: Product;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// ❌ NEVER use 'any' type
const handleData = (data: any) => {}; // ❌ WRONG

// ✅ CORRECT - Use proper types
const handleData = (data: Product[]) => {}; // ✅ CORRECT
```

---

## 🎨 12. UI/UX Consistency Rules

### Standard UI Patterns

```typescript
// ✅ Status badges
<StatusBadge status="active" />      // green
<StatusBadge status="pending" />     // yellow
<StatusBadge status="cancelled" />  // red

// ✅ Data tables
<DataTable
  data={products}
  columns={productColumns}
  onRowClick={handleRowClick}
/>

// ✅ Page headers
<PageHeader
  title="Products"
  description="Manage your product catalog"
  action={<Button>Create Product</Button>}
/>

// ✅ Empty states
<EmptyState
  icon={<Package />}
  title="No products yet"
  description="Get started by creating your first product"
  action={<Button>Create Product</Button>}
/>
```

---

## 🔑 13. Keyboard Shortcuts

```typescript
// ⌘K or Ctrl+K - Command Palette
// ⌘Shift+D or Ctrl+Shift+D - Dashboard
// ⌘Shift+N or Ctrl+Shift+N - New Order
// ⌘Shift+M or Ctrl+Shift+M - Menus
// ⌘Shift+I or Ctrl+Shift+I - Inventory
// ? - Show shortcuts help
```

**CRITICAL RULES:**

- ✅ **ALWAYS** implement keyboard shortcuts for common actions
- ✅ **ALWAYS** use `useAdminKeyboardShortcuts` hook
- ✅ **ALWAYS** show keyboard shortcuts in command palette

---

## 🚨 CRITICAL NEVER-DOS for Admin Panel

```typescript
// ❌ NEVER check admin status with localStorage
const isAdmin = localStorage.getItem('isAdmin'); // ❌ SECURITY RISK!

// ❌ NEVER store roles in profiles table
await supabase.from('profiles').update({ role: 'admin' }); // ❌ PRIVILEGE ESCALATION!

// ❌ NEVER skip tenant_id filter
await supabase.from('products').select('*'); // ❌ DATA LEAK!

// ❌ NEVER allow cross-tenant access
const { data } = await supabase.from('orders').select('*').eq('id', orderId); // ❌ Missing tenant_id!

// ❌ NEVER skip permission checks
<Button onClick={deleteOrder}>Delete</Button> // ❌ Should use PermissionGuard!

// ❌ NEVER skip feature access checks
<Link to="/admin/api-access">API Access</Link> // ❌ Should check tier!

// ❌ NEVER skip limit checks
await createProduct(); // ❌ Should check canCreate('products')!

// ❌ NEVER use hardcoded credentials
if (email === 'admin@example.com') { } // ❌ SECURITY RISK!
```

---

## 📋 Quick Reference Checklist

Before pushing admin panel changes:

- [ ] Used `useTenantAdminAuth()` for admin/tenant context
- [ ] Used `usePermissions()` for role checks
- [ ] Used `useFeatureAccess()` for tier checks
- [ ] Used `useTenantLimits()` for limit checks
- [ ] All queries filter by `tenant.id`
- [ ] All routes start with `/:tenantSlug/admin/`
- [ ] Used `TenantAdminProtectedRoute` wrapper
- [ ] Used `FeatureProtectedRoute` for tier-locked features
- [ ] Used `PermissionGuard` for role-restricted UI
- [ ] No localStorage for role/admin checks
- [ ] No `console.log` (use `logger`)
- [ ] All errors logged with context
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)

