# Troubleshooting Guide

Common issues and solutions when developing on the BigMike Platform.

## 🔍 Quick Diagnosis

### Run Compliance Check
```bash
bash scripts/check-rules-compliance.sh
```

This will identify most common issues automatically.

## 🐛 Common Issues

### Issue: TypeScript Errors

**Symptoms:**
- `npx tsc --noEmit` fails
- Type errors in IDE

**Solutions:**

1. **Missing types:**
   ```typescript
   // ❌ Wrong
   const data: any = await fetchData();
   
   // ✅ Correct
   import type { Product } from "@/types/product";
   const data: Product[] = await fetchData();
   ```

2. **Missing tenant context:**
   ```typescript
   // ❌ Wrong
   const { data } = await supabase.from("products").select("*");
   
   // ✅ Correct
   const { tenant } = useTenantAdminAuth();
   const { data } = await tenantQuery(supabase, "products", tenant.id).select("*");
   ```

3. **Fix:** Check [TypeScript Rules](./ULTIMATE_RULEBOOK.md#7-typescript-rules)

---

### Issue: Linter Errors

**Symptoms:**
- `npm run lint` fails
- ESLint warnings

**Common Fixes:**

1. **Console.log:**
   ```typescript
   // ❌ Wrong
   console.log("Debug:", data);
   
   // ✅ Correct
   import { logger } from "@/lib/logger";
   logger.debug("Debug info", { data }, { component: "MyComponent" });
   ```

2. **Any types:**
   ```typescript
   // ❌ Wrong
   function process(data: any) { }
   
   // ✅ Correct
   function process(data: unknown) {
     if (typeof data === "object" && data !== null) {
       // process
     }
   }
   ```

3. **Fix:** Run `npm run lint -- --fix` for auto-fixable issues

---

### Issue: Build Fails

**Symptoms:**
- `npm run build` fails
- Production build errors

**Solutions:**

1. **Check TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

2. **Check for missing imports:**
   - Ensure all `@/` imports are correct
   - Check file paths

3. **Check for circular dependencies:**
   - Avoid barrel exports in types
   - Use direct imports

4. **Memory issues:**
   ```bash
   # Build requires 4GB heap (already configured)
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

---

### Issue: Pre-Push Hook Blocks Push

**Symptoms:**
- `git push` fails with validation errors
- Hook reports violations

**Solutions:**

1. **Fix violations:**
   ```bash
   # See what's wrong
   bash scripts/check-rules-compliance.sh
   
   # Fix issues, then push again
   git push
   ```

2. **Common violations:**
   - Console.log → Replace with `logger`
   - Missing tenant_id → Use `tenantQuery()`
   - Any types → Replace with `unknown`
   - Hardcoded secrets → Use env vars

3. **Temporary skip (NOT RECOMMENDED):**
   ```bash
   git push --no-verify  # Only if absolutely necessary
   ```

---

### Issue: Tenant Isolation Not Working

**Symptoms:**
- Users see other tenant's data
- Queries return cross-tenant results

**Solutions:**

1. **Check query:**
   ```typescript
   // ❌ Wrong
   const { data } = await supabase.from("products").select("*");
   
   // ✅ Correct
   const { tenant } = useTenantAdminAuth();
   const { data } = await tenantQuery(supabase, "products", tenant.id).select("*");
   ```

2. **Check RLS policies:**
   ```sql
   -- Verify policy exists
   SELECT * FROM pg_policies 
   WHERE tablename = 'products' 
   AND policyname LIKE '%tenant%';
   ```

3. **Check Edge Function:**
   ```typescript
   // Ensure tenant validation
   const { data: tenantUser } = await supabase
     .from("tenant_users")
     .select("tenant_id")
     .eq("user_id", user.id)
     .eq("tenant_id", body.tenant_id)
     .maybeSingle();
   
   if (!tenantUser) {
     return new Response(..., { status: 403 });
   }
   ```

4. **Fix:** See [Tenant Isolation Guide](./TENANT_ISOLATION.md)

---

### Issue: Edge Function Returns CORS Error

**Symptoms:**
- Browser CORS errors
- Edge Function requests fail

**Solutions:**

1. **Check OPTIONS handling:**
   ```typescript
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
   ```

2. **Check response headers:**
   ```typescript
   return new Response(
     JSON.stringify(data),
     { 
       status: 200, 
       headers: { ...corsHeaders, "Content-Type": "application/json" } 
     }
   );
   ```

3. **Check config.toml:**
   ```toml
   [functions.your-function]
   verify_jwt = true  # or false for public endpoints
   ```

4. **Fix:** See [Edge Function Template](./templates/EdgeFunctionTemplate.ts)

---

### Issue: Database Migration Fails

**Symptoms:**
- Migration errors
- RLS policy conflicts

**Solutions:**

1. **Check SECURITY DEFINER:**
   ```sql
   -- ❌ Wrong
   CREATE FUNCTION my_func() SECURITY DEFINER AS $$ ... $$;
   
   -- ✅ Correct
   CREATE FUNCTION my_func() 
   SECURITY DEFINER 
   SET search_path = public  -- Required!
   AS $$ ... $$;
   ```

2. **Check foreign keys:**
   ```sql
   -- ❌ Wrong
   user_id UUID REFERENCES auth.users(id);
   
   -- ✅ Correct
   user_id UUID REFERENCES public.profiles(user_id);
   ```

3. **Check RLS policies:**
   ```sql
   -- Ensure policy exists
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```

4. **Fix:** See [Migration Template](./templates/MigrationTemplate.sql)

---

### Issue: Navigation Not Working

**Symptoms:**
- Links don't navigate
- Full page reloads
- Wrong routes

**Solutions:**

1. **Use React Router:**
   ```typescript
   // ❌ Wrong
   <a href="/dashboard">Dashboard</a>
   window.location.href = "/dashboard";
   
   // ✅ Correct
   import { Link, useNavigate } from "react-router-dom";
   <Link to="/dashboard">Dashboard</Link>
   navigate("/dashboard");
   ```

2. **Include tenant slug:**
   ```typescript
   // ❌ Wrong
   navigate("/admin/products");
   
   // ✅ Correct
   const { tenant } = useTenantAdminAuth();
   navigate(`/${tenant.slug}/admin/products`);
   ```

3. **Fix:** See [Navigation Rules](./ULTIMATE_RULEBOOK.md#3-navigation--redirects)

---

### Issue: Button Clicks Don't Work

**Symptoms:**
- Buttons don't respond
- No loading states
- Errors not shown

**Solutions:**

1. **Add loading state:**
   ```typescript
   const [loading, setLoading] = useState(false);
   
   const handleClick = async () => {
     try {
       setLoading(true);
       await operation();
     } finally {
       setLoading(false);
     }
   };
   
   <Button onClick={handleClick} disabled={loading}>
     {loading ? "Processing..." : "Submit"}
   </Button>
   ```

2. **Add error handling:**
   ```typescript
   try {
     await operation();
     toast.success("Success");
   } catch (error) {
     logger.error("Failed", error, { component: "MyComponent" });
     toast.error("Error");
   }
   ```

3. **Fix:** See [Button & Event Rules](./ULTIMATE_RULEBOOK.md#9-button--event-rules)

---

### Issue: React Query Not Updating

**Symptoms:**
- Data doesn't refresh
- Cache not invalidating

**Solutions:**

1. **Invalidate queries:**
   ```typescript
   const queryClient = useQueryClient();
   
   mutation.onSuccess = () => {
     queryClient.invalidateQueries({
       queryKey: queryKeys.products.lists()
     });
   };
   ```

2. **Check query keys:**
   ```typescript
   // ✅ Include tenant_id
   queryKey: queryKeys.products.list(tenant.id)
   ```

3. **Check enabled:**
   ```typescript
   enabled: !!tenant?.id  // Don't run if tenant not loaded
   ```

4. **Fix:** See [TanStack Query Rules](./ULTIMATE_RULEBOOK.md#24-state-management-with-tanstack-query)

---

### Issue: Permission Checks Not Working

**Symptoms:**
- Users see features they shouldn't
- Permission guards not working

**Solutions:**

1. **Use PermissionGuard:**
   ```typescript
   import { PermissionGuard } from "@/components/admin/PermissionGuard";
   
   <PermissionGuard permission="products:create">
     <Button>Create Product</Button>
   </PermissionGuard>
   ```

2. **Check hook:**
   ```typescript
   const { checkPermission } = usePermissions();
   
   if (!checkPermission("products:create")) {
     toast.error("No permission");
     return;
   }
   ```

3. **Check Edge Function:**
   ```typescript
   // Validate on server side too
   const { data: hasRole } = await supabase
     .rpc("has_role", { _user_id: user.id, _role: "admin" });
   ```

4. **Fix:** See [Admin Panel Rules](./ADMIN_PANEL_RULES.md#2-role-based-permissions-critical)

---

## 🔧 Debugging Tools

### Check Logs
```typescript
// Frontend logs (development only)
logger.debug("Debug info", { data }, { component: "MyComponent" });

// Always logged
logger.error("Error", error, { component: "MyComponent" });
```

### Check Network
- Open browser DevTools → Network tab
- Check Edge Function requests
- Verify Authorization headers
- Check response status codes

### Check Database
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Check tenant isolation
SELECT * FROM tenant_users WHERE user_id = 'user-uuid';

-- Check data
SELECT * FROM your_table WHERE tenant_id = 'tenant-uuid';
```

## 📚 Get More Help

- [Ultimate Rulebook](./ULTIMATE_RULEBOOK.md) - Complete rules reference
- [Rules Quick Reference](./RULES_QUICK_REFERENCE.md) - Quick cheat sheet
- [Getting Started](./GETTING_STARTED.md) - Onboarding guide
- [Tenant Isolation Guide](./TENANT_ISOLATION.md) - Tenant system docs

## 🆘 Still Stuck?

1. Run compliance check: `bash scripts/check-rules-compliance.sh`
2. Check pre-push hook output
3. Review relevant documentation
4. Check code templates for examples
5. Verify all rules are followed

