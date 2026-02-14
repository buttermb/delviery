# Rules Quick Reference Card

## 🚨 Critical Never-Dos

1. ❌ **NEVER** edit auto-generated files (`client.ts`, `types.ts`, `config.toml` project_id)
2. ❌ **NEVER** use `console.log` in frontend (use `logger`)
3. ❌ **NEVER** use `any` type (use `unknown`)
4. ❌ **NEVER** reference `auth.users` in foreign keys
5. ❌ **NEVER** create `SECURITY DEFINER` without `SET search_path = public`
6. ❌ **NEVER** skip `tenant_id` filter in multi-tenant queries
7. ❌ **NEVER** skip Zod validation in Edge Functions
8. ❌ **NEVER** use `window.location` (use `useNavigate` or `Link`)
9. ❌ **NEVER** use `<a>` tags for internal navigation
10. ❌ **NEVER** skip error handling in async operations

## ✅ Always Do

### Frontend
- ✅ Use `logger` from `@/lib/logger`
- ✅ Use `@/` alias for all imports
- ✅ Use `tenantQuery()` helper for all queries
- ✅ Use `useTenantAdminAuth()` for tenant context
- ✅ Use `useNavigate()` or `<Link>` for navigation
- ✅ Show loading states for async operations
- ✅ Handle errors with try-catch
- ✅ Use named exports (not default)
- ✅ Define props interfaces

### Edge Functions
- ✅ Import from `_shared/deps.ts`
- ✅ Use Zod validation for `req.json()`
- ✅ Handle OPTIONS requests
- ✅ Return CORS headers in ALL responses
- ✅ Wrap with `withZenProtection`
- ✅ Validate environment variables
- ✅ Validate tenant access

### Database
- ✅ All tables have RLS enabled
- ✅ All multi-tenant tables have `tenant_id`
- ✅ All RLS policies filter by `tenant_id`
- ✅ `SECURITY DEFINER` functions have `SET search_path = public`
- ✅ Foreign keys reference `public.profiles` (not `auth.users`)

## 📋 Pre-Push Checklist

```bash
# Quick validation
npx tsc --noEmit && npm run lint && npm run build

# Full compliance check
bash scripts/check-rules-compliance.sh
```

## 🔗 Quick Links

- [Ultimate Rulebook](./ULTIMATE_RULEBOOK.md) - Complete guide
- [Admin Panel Rules](./ADMIN_PANEL_RULES.md) - Admin patterns
- [Tenant Isolation](./TENANT_ISOLATION.md) - Tenant system
- [Schema Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) - Database patterns

## 💡 Common Patterns

### Query with Tenant
```typescript
const { data } = await tenantQuery(supabase, 'products', tenant.id)
  .select('*');
```

### Navigation
```typescript
navigate(`/${tenant.slug}/admin/products`);
```

### Error Handling
```typescript
try {
  await operation();
  toast.success("Success");
} catch (error) {
  logger.error("Failed", error, { component: "MyComponent" });
  toast.error("Error");
}
```

### Edge Function Template
```typescript
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const Schema = z.object({ tenant_id: z.string().uuid() });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // ... validation, tenant check, business logic
});
```

