# 🚀 Lovable Quick Reference - Implementation Checklist

Quick checklist for implementing features correctly without bugs.

---

## ⚙️ Setup (5 minutes)

```bash
# 1. Environment Variables (Supabase Dashboard → Edge Functions → Secrets)
STRIPE_SECRET_KEY=sk_test_...  # Required for payments
SITE_URL=https://your-domain.com  # Required for redirects

# 2. Database Tables (Minimum Required)
✅ tenants (with subscription_plan, limits, usage, features columns)
✅ tenant_users (with role column)
✅ invoices (for billing)

# 3. Verify Build
npm run build  # Should complete without errors
```

---

## 🎯 Critical Patterns

### ✅ Pattern 1: Query Optional Tables

```typescript
const { data, error } = await supabase.from('optional_table')...
if (error && error.code === '42P01') return [];  // Table doesn't exist
if (error) throw error;
return data || [];
```

### ✅ Pattern 2: Handle Missing Columns

```typescript
const usage = tenant?.usage || {};  // Default if missing
const limits = tenant?.limits || {};  // Default if missing
const onboarding = tenant?.onboarding_completed ?? false;
```

### ✅ Pattern 3: Edge Function Template

```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    // 1. Verify auth
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    // 2. Validate input
    const { tenant_id } = await req.json();
    if (!tenant_id) return error(400, 'Missing tenant_id');
    
    // 3. Check permissions
    const tenantUser = await getTenantUser(tenant_id, user.email);
    if (!tenantUser || !['owner', 'admin'].includes(tenantUser.role)) {
      return error(403, 'Insufficient permissions');
    }
    
    // 4. Your logic
    // ...
    
    return success(result);
  } catch (error) {
    return error(500, error.message);
  }
});
```

### ✅ Pattern 4: Mutation with Error Handling

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const { data: result, error } = await supabase.from('table').insert(data);
    if (error?.code === '42P01') throw new Error('Table missing - run migrations');
    if (error) throw error;
    return result;
  },
  onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
});
```

---

## 🐛 Common Bugs → Fixes

| Bug | Fix |
|-----|-----|
| `error.code === '42P01'` | Check for this code, return `[]` |
| Missing column errors | Use `|| {}` or `?? false` defaults |
| `await in useEffect` | Wrap in `(async () => {})()` |
| TypeScript "excessively deep" | Use `as any` for dynamic table names |
| Missing imports | Import components before using in routes |
| Duplicate routes | Define each route once |
| Stripe not working | Set `STRIPE_SECRET_KEY` in Supabase secrets |

---

## 📋 Feature Implementation Checklist

### Billing & Subscription
- [ ] Edge Function: `update-subscription` deployed
- [ ] Edge Function: `stripe-customer-portal` deployed
- [ ] `STRIPE_SECRET_KEY` set in environment
- [ ] `SITE_URL` set in environment
- [ ] Proration calculation working
- [ ] Invoice generation working
- [ ] Payment method buttons functional

### Authentication
- [ ] Edge Functions deployed: `tenant-admin-auth`, `super-admin-auth`, `customer-auth`
- [ ] Token refresh implemented
- [ ] 401 errors handled gracefully

### Database
- [ ] Required tables exist: `tenants`, `tenant_users`, `invoices`
- [ ] Optional tables handled gracefully (error code `42P01`)
- [ ] RLS policies configured

---

## 🔑 Key Constants

```typescript
// Plan Prices
PLAN_PRICES = { starter: 99, professional: 299, enterprise: 600 }

// Plan Limits
PLAN_LIMITS = {
  starter: { customers: 50, menus: 3, products: 100 },
  professional: { customers: 200, menus: 10, products: 500 },
  enterprise: { customers: -1, menus: -1, products: -1 }
}
```

---

## ⚡ Quick Fixes

**Build failing?**
- Check for missing imports
- Check for TypeScript errors
- Check for duplicate routes

**Queries failing?**
- Add error code check: `if (error?.code === '42P01') return []`
- Provide defaults for missing columns

**Stripe not working?**
- Check `STRIPE_SECRET_KEY` is set
- Verify key format (starts with `sk_`)
- Check Stripe Dashboard for errors

**Authentication failing?**
- Check token in localStorage
- Verify Edge Function is deployed
- Check user role in database

---

## 📞 Quick Commands

```bash
# Check build
npm run build

# View Edge Function logs
supabase functions logs update-subscription

# Deploy Edge Function
supabase functions deploy update-subscription

# Set secret
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
```

---

**Remember:** Always check for `error.code === '42P01'` for optional tables!

---

## ✅ Restored Pages Status

**All 34 deleted pages have been restored:**
- Phase 2: 8 Professional tier pages ✅
- Phase 3: 5 Professional tier pages ✅
- Phase 4: 7 Enterprise tier pages ✅
- Phase 5: 5 Enterprise tier pages ✅
- Phase 6: 9 Enterprise tier pages ✅

**All pages implement graceful error handling for missing tables.**

