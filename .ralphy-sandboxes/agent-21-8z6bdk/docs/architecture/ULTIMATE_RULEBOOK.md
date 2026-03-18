# 📘 ULTIMATE DEVELOPMENT RULEBOOK

## BigMike Wholesale Platform - Complete Error-Prevention Guide

---

## 🗂️ 1. FILE & FOLDER STRUCTURE

### 1.1 Project Organization

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # ShadCN UI primitives (auto-generated)
│   ├── admin/          # Admin panel components
│   ├── auth/           # Auth-related components
│   ├── tenant-admin/   # Tenant admin components
│   └── [feature]/      # Feature-specific components
├── pages/              # Route pages
│   ├── admin/          # Legacy admin pages
│   ├── tenant-admin/   # Tenant admin pages (/:tenantSlug/admin/*)
│   ├── customer/       # Customer portal pages
│   ├── courier/        # Courier app pages
│   └── super-admin/    # Platform admin pages
├── hooks/              # Custom React hooks
├── contexts/           # React contexts (providers)
├── lib/                # Utilities, constants, APIs
│   ├── utils/          # Helper functions
│   ├── auth/           # Auth utilities
│   └── api/            # API clients
├── types/              # TypeScript type definitions
├── constants/          # Constants (storageKeys, etc.)
└── integrations/       # Third-party integrations
    └── supabase/       # ❌ AUTO-GENERATED - NEVER EDIT
```

### 1.2 Naming Conventions

#### ✅ CORRECT:

```typescript
// React Components: PascalCase
ProductCard.tsx
CustomerDashboard.tsx
AdminLayout.tsx

// Hooks: camelCase with 'use' prefix
useLocalStorage.ts
useTenantAdminAuth.ts
usePermissions.ts

// Utilities: camelCase
formatCurrency.ts
validateEmail.ts
queryKeys.ts

// Constants: UPPER_SNAKE_CASE
STORAGE_KEYS.ts
API_ENDPOINTS.ts

// Types: PascalCase
UserProfile.ts
OrderStatus.ts
```

#### ❌ WRONG:

```typescript
// Don't use snake_case for components
product_card.tsx          // ❌
customer-dashboard.tsx    // ❌

// Don't use kebab-case for hooks
use-local-storage.ts      // ❌

// Don't use PascalCase for utilities
FormatCurrency.ts         // ❌
```

### 1.3 Import Paths

#### ✅ ALWAYS use `@/` alias:

```typescript
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/types/product";
```

#### ❌ NEVER use relative paths:

```typescript
import { Button } from "../../components/ui/button";     // ❌
import { logger } from "../../../lib/logger";             // ❌
```

### 1.4 Import Order (Standardized)

```typescript
// 1. React imports
import { useState, useEffect, useCallback } from "react";

// 2. Third-party libraries
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

// 3. Types
import type { Product, Order } from "@/types";

// 4. Components
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/DataTable";

// 5. Hooks
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePermissions } from "@/hooks/usePermissions";

// 6. Utilities
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { STORAGE_KEYS } from "@/constants/storageKeys";
```

---

## ⚛️ 2. REACT + SHADCN RULES

### 2.1 Component Structure

#### ✅ CORRECT PATTERN:

```typescript
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  disabled?: boolean;
}

export const ProductCard = ({ product, onAddToCart, disabled = false }: ProductCardProps) => {
  const [loading, setLoading] = useState(false);

  const handleAddToCart = useCallback(async () => {
    try {
      setLoading(true);
      await onAddToCart(product.id);
      toast.success("Added to cart");
    } catch (error) {
      logger.error("Failed to add to cart", error, { component: "ProductCard", productId: product.id });
      toast.error("Failed to add to cart");
    } finally {
      setLoading(false);
    }
  }, [product.id, onAddToCart]);

  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <Button onClick={handleAddToCart} disabled={disabled || loading}>
        {loading ? "Adding..." : "Add to Cart"}
      </Button>
    </div>
  );
};
```

#### ❌ WRONG PATTERNS:

```typescript
// ❌ No inline props
export const ProductCard = (props: any) => { ... }

// ❌ No default exports for components
export default ProductCard;

// ❌ No console.log
console.log("Product:", product);

// ❌ No missing error handling
<Button onClick={() => onAddToCart(product.id)}>Add</Button>  // No try-catch!
```

### 2.2 Hook Usage Rules

#### ✅ useEffect:

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('orders')
    .on('postgres_changes', { ... }, handleChange)
    .subscribe();

  // ✓ ALWAYS cleanup
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

#### ✅ useCallback:

```typescript
// ✓ Use for event handlers passed to children
const handleSubmit = useCallback(async (data: FormData) => {
  // ...
}, [dependency]);
```

#### ✅ useMemo:

```typescript
// ✓ Use for expensive calculations
const filteredProducts = useMemo(() => {
  return products.filter(p => p.price > minPrice && p.inStock);
}, [products, minPrice]);
```

### 2.3 Event Handler Safety

#### ✅ CORRECT:

```typescript
// ✓ Async with loading state
const [loading, setLoading] = useState(false);

const handleClick = async () => {
  try {
    setLoading(true);
    await mutation.mutateAsync(data);
    toast.success("Success");
  } catch (error) {
    logger.error("Mutation failed", error, { component: "MyComponent" });
    toast.error("Error");
  } finally {
    setLoading(false);
  }
};

<Button onClick={handleClick} disabled={loading}>
  {loading ? "Processing..." : "Submit"}
</Button>
```

#### ❌ WRONG:

```typescript
// ❌ No error handling
<Button onClick={() => mutation.mutate(data)}>Submit</Button>

// ❌ No loading state
<Button onClick={handleClick}>Submit</Button>

// ❌ Page reload on click
<Button onClick={handleClick}>Submit</Button>  // Without preventing default
```

### 2.4 State Management with TanStack Query

#### ✅ CORRECT PATTERN:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { tenantQuery } from "@/lib/utils/tenantQueries";

const ProductList = () => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // ✓ Use query key factory
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id || ""),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");
      
      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .select("*");
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // ✓ Invalidate queries on mutation
  const createProduct = useMutation({
    mutationFn: async (product: NewProduct) => {
      if (!tenant?.id) throw new Error("Tenant not loaded");
      
      const { data, error } = await tenantQuery(supabase, "products", tenant.id)
        .insert({ ...product, tenant_id: tenant.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products.lists()
      });
      toast.success("Product created");
    },
    onError: (error: unknown) => {
      logger.error("Failed to create product", error, { component: "ProductList" });
      toast.error("Error");
    },
  });

  return {/* ... */};
};
```

---

## 🔗 3. NAVIGATION & REDIRECTS

### 3.1 Navigation Patterns

#### ✅ CORRECT:

```typescript
import { useNavigate } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const MyComponent = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();

  const handleViewDetails = () => {
    navigate(`/${tenant.slug}/admin/products/${product.id}`);
  };

  return (
    <Button onClick={handleViewDetails}>
      View Details
    </Button>
  );
};
```

#### ✅ CORRECT (Link component):

```typescript
import { Link } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const MyComponent = () => {
  const { tenant } = useTenantAdminAuth();
  
  return (
    <Link to={`/${tenant.slug}/admin/dashboard`}>
      Go to Dashboard
    </Link>
  );
};
```

#### ❌ WRONG:

```typescript
// ❌ Don't use window.location (causes full page reload)
<Button onClick={() => window.location.href = "/dashboard"}>
  Dashboard
</Button>

// ❌ Don't use <a> tags for internal navigation
<a href="/dashboard">Dashboard</a>

// ❌ Don't use hardcoded routes
navigate("/admin/dashboard");  // Missing tenant slug!
```

### 3.2 Guarded Routes

#### ✅ TENANT ADMIN ROUTES:

```typescript
import { TenantAdminProtectedRoute } from "@/components/auth/TenantAdminProtectedRoute";
import { FeatureProtectedRoute } from "@/components/auth/FeatureProtectedRoute";

<Route
  path="/:tenantSlug/admin/products"
  element={
    <TenantAdminProtectedRoute>
      <FeatureProtectedRoute featureId="products">
        <ProductsPage />
      </FeatureProtectedRoute>
    </TenantAdminProtectedRoute>
  }
/>
```

### 3.3 Dynamic Routes

#### ✅ CORRECT PATTERN:

```typescript
// Route definition
<Route path="/:tenantSlug/admin/products/:productId" element={<ProductDetail />} />

// Component
import { useParams } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const ProductDetail = () => {
  const { tenantSlug, productId } = useParams<{ tenantSlug: string; productId: string }>();
  const { tenant } = useTenantAdminAuth();

  // Validate tenantSlug matches logged-in tenant
  useEffect(() => {
    if (tenant && tenant.slug !== tenantSlug) {
      logger.warn("Tenant mismatch in URL", undefined, { component: "ProductDetail" });
      navigate(`/${tenant.slug}/admin/products/${productId}`);
    }
  }, [tenant, tenantSlug, productId, navigate]);

  // ...
};
```

---

## 💾 4. DATABASE & SCHEMA RULES

### 4.1 Table Creation (Migration Format)

#### ✅ CORRECT:

```sql
-- supabase/migrations/20250128143022_create_products_table.sql

-- 1. Create table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_created_at ON public.products(created_at);

-- 3. Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Tenant isolation for products"
  ON public.products FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

### 4.2 Foreign Key Rules

#### ✅ ALWAYS:

```sql
-- ✓ Reference public.profiles (NOT auth.users)
user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE

-- ✓ Reference public tables
tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE
```

#### ❌ NEVER:

```sql
-- ❌ NEVER reference auth.users
user_id UUID REFERENCES auth.users(id)  -- FORBIDDEN!

-- ❌ Don't forget ON DELETE
order_id UUID REFERENCES orders(id)  -- Missing cascade!
```

### 4.3 SECURITY DEFINER Functions

#### ✅ CRITICAL - ALWAYS include `SET search_path`:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public  -- ⚠️ REQUIRED! Prevents privilege escalation
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

#### ❌ NEVER DO THIS:

```sql
-- ❌ Missing SET search_path = public (SECURITY VULNERABILITY!)
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
  SELECT EXISTS (...)
$$;
```

### 4.4 RLS Policy Patterns

#### ✅ STANDARD PATTERNS:

**Tenant Isolation:**

```sql
CREATE POLICY "Tenant users can view their data"
  ON table_name FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

**Admin Access:**

```sql
CREATE POLICY "Admins can manage all data"
  ON table_name FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

**User Owns Record:**

```sql
CREATE POLICY "Users can view own records"
  ON table_name FOR SELECT
  USING (user_id = auth.uid());
```

#### ❌ NEVER DO THIS:

```sql
-- ❌ Self-referencing policy (infinite recursion!)
CREATE POLICY "Check role" ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## 🔧 5. EDGE FUNCTION RULES

### 5.1 Required File Structure

```
supabase/functions/
├── _shared/
│   ├── deps.ts              # Shared dependencies
│   ├── validation.ts        # Input validation utilities
│   ├── zen-firewall.ts      # Security wrapper
│   └── schemas.ts           # Zod schemas (create if missing)
├── function-name/
│   └── index.ts             # Main function file
```

### 5.2 Complete Edge Function Template

See [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md#22-complete-edge-function-template) for the complete template.

**Key Requirements:**
- ✅ Import from `_shared/deps.ts`
- ✅ Define Zod schema
- ✅ Wrap with `withZenProtection`
- ✅ Handle OPTIONS for CORS
- ✅ Validate environment variables
- ✅ Extract and validate JWT user
- ✅ Verify tenant access
- ✅ Filter all queries by `tenant_id`
- ✅ Return CORS headers in ALL responses

### 5.3 supabase/config.toml Rules

#### ✅ CORRECT:

```toml
project_id = "aejugtmhwwknrowfyzie"  # ⚠️ MUST BE FIRST LINE! DON'T TOUCH!

# Public endpoints (no auth)
[functions.track-access]
verify_jwt = false

# Protected endpoints (auth required)
[functions.create-product]
verify_jwt = true

[functions.admin-actions]
verify_jwt = true
```

---

## 🔒 6. SECURITY RULES

### 6.1 Storage & Secrets

#### ✅ CORRECT:

```typescript
// ✓ Use STORAGE_KEYS constants
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeStorage } from "@/constants/storageKeys";

const token = safeStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);

// ✓ Use environment variables
const apiKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
```

#### ❌ WRONG:

```typescript
// ❌ Hardcoded strings
const token = localStorage.getItem("tenant_admin_token");

// ❌ Secrets in code
const apiKey = "sk_live_abc123";  // NEVER!

// ❌ Store sensitive data
localStorage.setItem("password", password);  // NEVER!
```

### 6.2 Input Sanitization

#### ✅ ALWAYS validate:

```typescript
import { z } from "zod";

const ContactFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(1000),
});

const handleSubmit = async (data: unknown) => {
  try {
    const validated = ContactFormSchema.parse(data);
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Show validation errors
    }
  }
};
```

### 6.3 Never Use

#### ❌ FORBIDDEN:

```typescript
// ❌ dangerouslySetInnerHTML with user content
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ❌ eval()
eval(userCode);

// ❌ Function constructor
new Function(userCode)();

// ❌ Logging sensitive data
console.log("Password:", password);  // NEVER!
```

---

## 💡 7. TYPESCRIPT RULES

### 7.1 Type Safety

#### ✅ ALWAYS:

```typescript
// ✓ Define interfaces for props
interface ProductCardProps {
  product: Product;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

// ✓ Explicit return types
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ✓ Use unknown for errors
try {
  // ...
} catch (error: unknown) {
  if (error instanceof Error) {
    logger.error("Failed", error, { component: "MyComponent" });
  }
}
```

#### ❌ NEVER:

```typescript
// ❌ any type
function process(data: any) { ... }

// ❌ Implicit any
function calculate(items) { ... }

// ❌ Type assertions without validation
const product = data as Product;  // Dangerous!
```

### 7.2 Type Imports

#### ✅ CORRECT:

```typescript
import type { Product, Order, Customer } from "@/types";
import { Button } from "@/components/ui/button";
```

---

## 🧭 8. ROUTING & TENANT LOGIC

### 8.1 Tenant Admin Routes

#### ✅ ALL ROUTES MUST:

- Start with `/:tenantSlug/admin/`
- Be wrapped with `TenantAdminProtectedRoute`
- Use `useTenantAdminAuth()` hook
- Filter queries by `tenant.id`

```typescript
// Route
<Route
  path="/:tenantSlug/admin/products"
  element={
    <TenantAdminProtectedRoute>
      <ProductsPage />
    </TenantAdminProtectedRoute>
  }
/>

// Component
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { tenantQuery } from "@/lib/utils/tenantQueries";

const ProductsPage = () => {
  const { tenant } = useTenantAdminAuth();

  const { data: products } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id || ""),
    queryFn: async () => {
      if (!tenant?.id) throw new Error("Tenant not loaded");
      
      const { data } = await tenantQuery(supabase, "products", tenant.id)
        .select("*");
      
      return data;
    },
    enabled: !!tenant?.id,
  });

  return {/* ... */};
};
```

### 8.2 Permission & Feature Gating

#### ✅ CORRECT:

```typescript
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useTenantLimits } from "@/hooks/useTenantLimits";
import { PermissionGuard } from "@/components/admin/PermissionGuard";

const ProductsPage = () => {
  const { checkPermission } = usePermissions();
  const { canAccess } = useFeatureAccess();
  const { canCreate, getLimit } = useTenantLimits();

  const handleCreate = () => {
    if (!checkPermission("products:create")) {
      toast.error("No permission");
      return;
    }

    if (!canCreate("products")) {
      toast.error(`Limit reached: Max ${getLimit("products")} products allowed`);
      return;
    }

    // Proceed with creation
  };

  return (
    <>
      {canAccess("advanced_analytics") && <AnalyticsPanel />}
      <PermissionGuard permission="products:create">
        <Button onClick={handleCreate}>Create Product</Button>
      </PermissionGuard>
    </>
  );
};
```

---

## 💡 9. BUTTON & EVENT RULES

### 9.1 Navigation Buttons

#### ✅ CORRECT:

```typescript
import { useNavigate } from "react-router-dom";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const MyComponent = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();

  return (
    <Button onClick={() => navigate(`/${tenant.slug}/admin/products`)}>
      View Products
    </Button>
  );
};
```

### 9.2 Async Action Buttons

#### ✅ CORRECT:

```typescript
const [loading, setLoading] = useState(false);

const handleDelete = async (id: string) => {
  try {
    setLoading(true);
    await mutation.mutateAsync({ id });
    toast.success("Deleted successfully");
  } catch (error) {
    logger.error("Delete failed", error, { component: "MyComponent" });
    toast.error("Error");
  } finally {
    setLoading(false);
  }
};

<Button onClick={() => handleDelete(product.id)} disabled={loading}>
  {loading ? "Deleting..." : "Delete"}
</Button>
```

---

## ⚙️ 10. BACKEND INTEGRATION

### 10.1 Edge Function Calls

#### ✅ CORRECT:

```typescript
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

const useCreateProduct = () => {
  const { tenant, accessToken } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async (product: NewProduct) => {
      const { data, error } = await supabase.functions.invoke("create-product", {
        body: {
          ...product,
          tenant_id: tenant.id,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      return data;
    },
  });
};
```

---

## ✅ 11. PRE-PUSH VALIDATION

### Run Before Every Push:

```bash
# 1. TypeScript check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build test
npm run build

# 4. Check auto-generated files (should be empty)
git diff src/integrations/supabase/client.ts
git diff src/integrations/supabase/types.ts
git diff supabase/config.toml | grep "project_id"

# 5. Validate no console.log in src/
grep -r "console.log" src/

# 6. Validate SECURITY DEFINER functions
grep -r "SECURITY DEFINER" supabase/migrations/ | grep -v "search_path"

# 7. Validate no auth.users references
grep -r "REFERENCES auth.users" supabase/migrations/

# 8. Install pre-push hook
bash scripts/install-hooks.sh
```

---

## 🧪 12. TESTING & QA CHECKLIST

### Before Pushing:

- [ ] All pages load without errors
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No `console.log` in `src/`
- [ ] All buttons navigate correctly
- [ ] All forms validate properly
- [ ] All mutations handle errors
- [ ] Tenant isolation verified (queries filter by `tenant_id`)
- [ ] RLS policies enabled on all tables
- [ ] Edge functions have Zod validation
- [ ] Edge functions handle CORS
- [ ] No edits to auto-generated files

---

## 🚨 13. CRITICAL NEVER-DOS

### ❌ ABSOLUTELY FORBIDDEN:

1. **NEVER edit auto-generated files:**
   - `src/integrations/supabase/client.ts`
   - `src/integrations/supabase/types.ts`
   - `supabase/config.toml` (project_id line)
   - `.env`

2. **NEVER reference `auth.users` in foreign keys**

3. **NEVER create `SECURITY DEFINER` functions without `SET search_path = public`**

4. **NEVER skip `tenant_id` filter in multi-tenant queries**

5. **NEVER skip Zod validation in Edge Functions**

6. **NEVER use `console.log` in frontend code** (use `logger`)

7. **NEVER store sensitive data in localStorage**

8. **NEVER use `any` type**

9. **NEVER bypass permission/feature/limit guards**

10. **NEVER modify reserved schemas:** `auth.*`, `storage.*`, `realtime.*`, `vault.*`

---

## 📋 14. DEVELOPER QUICK CHECKLIST

### ✅ Before Every Commit:

```
□ TypeScript compiles (npx tsc --noEmit)
□ Linter passes (npm run lint)
□ Build succeeds (npm run build)
□ No console.log statements
□ No hardcoded secrets
□ No edits to auto-generated files
□ All queries filter by tenant_id (multi-tenant)
□ All edge functions have Zod validation
□ All edge functions handle CORS
□ All SECURITY DEFINER functions have SET search_path
□ All foreign keys reference public schema (not auth.users)
□ All buttons have loading states
□ All async operations have error handling
□ Conventional commit message (feat:, fix:, refactor:, etc.)
```

---

## 📚 Related Documentation

- [Admin Panel Rules](./ADMIN_PANEL_RULES.md) - Admin-specific patterns
- [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) - Database patterns
- [Tenant Isolation Guide](./TENANT_ISOLATION.md) - Tenant isolation system
- [Complete Rules Reference](./COMPLETE_RULES_REFERENCE.md) - All rules consolidated

