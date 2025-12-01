# Admin Panel Pre-Push Checklist

## 🔍 Quick Validation Checklist

Use this checklist before every push to ensure admin panel code follows all rules.

### Authentication & Context
- [ ] Used `useTenantAdminAuth()` hook (not localStorage)
- [ ] Checked `loading` state before rendering
- [ ] Used `accessToken` for Edge Function calls
- [ ] Validated tenant slug matches URL path

### Permissions & Roles
- [ ] Used `usePermissions()` hook for role checks
- [ ] Used `PermissionGuard` component for UI elements
- [ ] Validated permissions in Edge Functions (server-side)
- [ ] No roles stored in `profiles` table (use `user_roles`)

### Tenant Isolation
- [ ] All queries filter by `tenant.id`
- [ ] All RLS policies include `tenant_id` check
- [ ] Edge Functions validate tenant context
- [ ] No cross-tenant data access possible

### Feature Access
- [ ] Used `useFeatureAccess()` hook for tier checks
- [ ] Used `FeatureProtectedRoute` for tier-locked routes
- [ ] Showed upgrade prompts when feature locked
- [ ] Validated feature access in Edge Functions

### Resource Limits
- [ ] Used `useTenantLimits()` hook
- [ ] Checked `canCreate(resource)` before creation
- [ ] Showed limit warnings at 80% usage
- [ ] Showed upgrade prompts when limits reached

### Code Quality
- [ ] No `console.log` in frontend (use `logger`)
- [ ] All errors logged with context
- [ ] User-friendly error messages (toast)
- [ ] TypeScript types from `src/types/` (not inline)
- [ ] Used `queryKeys` factory for TanStack Query
- [ ] Memoized expensive computations
- [ ] Cleaned up subscriptions in `useEffect`

### Security
- [ ] No hardcoded secrets
- [ ] No localStorage for role checks
- [ ] Input validation on client and server
- [ ] Sanitized user input before rendering
- [ ] No `eval()` or `Function()` constructor
- [ ] No `dangerouslySetInnerHTML` with user content

### Edge Functions
- [ ] Imported from `_shared/deps.ts`
- [ ] Used Zod validation for `req.json()`
- [ ] Handled OPTIONS requests
- [ ] Returned CORS headers in ALL responses
- [ ] Wrapped with `withZenProtection`
- [ ] Validated environment variables
- [ ] Validated tenant_id matches user's tenant

### Database
- [ ] All tables have RLS enabled
- [ ] Multi-tenant tables have `tenant_id` column
- [ ] RLS policies filter by `tenant_id`
- [ ] No foreign keys to `auth.users` (use `public.profiles`)
- [ ] `SECURITY DEFINER` functions have `SET search_path = public`
- [ ] Used `.maybeSingle()` for optional data
- [ ] Checked for errors after database operations

### Auto-Generated Files
- [ ] Did NOT edit `src/integrations/supabase/client.ts`
- [ ] Did NOT edit `src/integrations/supabase/types.ts`
- [ ] Did NOT edit `supabase/config.toml` (project_id)
- [ ] Did NOT edit `.env`

### Testing
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Pre-push hook passes (`git push`)

---

## 🚨 Critical Security Checks

Before pushing, verify these security-critical items:

- [ ] No admin status checks using localStorage
- [ ] No roles stored in profiles table
- [ ] All queries filter by tenant_id
- [ ] All RLS policies enforce tenant isolation
- [ ] Edge Functions validate tenant context
- [ ] No hardcoded API keys or secrets
- [ ] Input validation on all user inputs
- [ ] Password hashing uses bcrypt (not SHA-256)

---

## 📋 Common Mistakes to Avoid

### ❌ Authentication Mistakes
```typescript
// ❌ WRONG
const isAdmin = localStorage.getItem('isAdmin') === 'true';

// ✅ CORRECT
const { admin } = useTenantAdminAuth();
```

### ❌ Tenant Isolation Mistakes
```typescript
// ❌ WRONG
const { data } = await supabase.from('products').select('*');

// ✅ CORRECT
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', tenant.id);
```

### ❌ Permission Mistakes
```typescript
// ❌ WRONG
<Button onClick={deleteOrder}>Delete</Button>

// ✅ CORRECT
<PermissionGuard permission="orders:delete">
  <Button onClick={deleteOrder}>Delete</Button>
</PermissionGuard>
```

### ❌ Feature Access Mistakes
```typescript
// ❌ WRONG
<Link to="/admin/api-access">API Access</Link>

// ✅ CORRECT
<FeatureProtectedRoute featureId="api-access">
  <Link to="/admin/api-access">API Access</Link>
</FeatureProtectedRoute>
```

### ❌ Limit Check Mistakes
```typescript
// ❌ WRONG
await createProduct();

// ✅ CORRECT
if (!canCreate('products')) {
  toast.error('Product limit reached');
  return;
}
await createProduct();
```

---

## 🔧 Quick Commands

```bash
# Run all validations
npm run lint && npx tsc --noEmit && npm run build

# Check for console.log in frontend
grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "supabase/functions"

# Check for hardcoded secrets
grep -r "sk_live\|api_key.*=" src/ --include="*.ts" --include="*.tsx"

# Check for localStorage without STORAGE_KEYS
grep -r "localStorage\.(getItem|setItem)" src/ --include="*.ts" --include="*.tsx" | grep -v "STORAGE_KEYS"

# Validate edge functions
grep -r "req\.json()" supabase/functions/ --include="index.ts" | grep -v "z\.object\|safeParse\|parse"

# Check SECURITY DEFINER functions
grep -r "SECURITY DEFINER" supabase/migrations/ | grep -v "search_path"
```

---

## 📚 Reference Documentation

- [Admin Panel Rules](./ADMIN_PANEL_RULES.md) - Complete admin panel rules
- [Schema & Edge Function Rules](./SCHEMA_EDGE_FUNCTION_RULES.md) - Database and edge function rules
- [Supabase Rules](./SUPABASE_RULES.md) - Detailed Supabase rules
- [Complete Rules Reference](./COMPLETE_RULES_REFERENCE.md) - All rules in one place
- [Development Guide](../DEVELOPMENT.md) - Quick start guide

