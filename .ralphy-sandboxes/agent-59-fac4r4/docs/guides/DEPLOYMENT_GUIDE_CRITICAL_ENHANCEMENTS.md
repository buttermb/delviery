# Deployment Guide - Critical Enhancements

## Date: 2025-01-15
## Status: Ready for Deployment

---

## 📋 Pre-Deployment Checklist

### 1. Verify Database State
- [ ] All existing migrations are applied
- [ ] `audit_trail` table exists (or will be created)
- [ ] `activity_logs` table exists (or will be created)
- [ ] `inventory_alerts` table exists (references `wholesale_inventory`, not `products`)
- [ ] `products` table has `available_quantity` column
- [ ] `tenants` table has `subscription_plan` and `subscription_status` columns

### 2. Verify Code Changes
- [ ] TypeScript compilation passes: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No console.log statements (use logger instead)

### 3. Test Real-time Subscriptions
- [ ] Super admin dashboard loads without errors
- [ ] Tenant admin context loads without errors
- [ ] Real-time subscriptions connect successfully

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migrations

```bash
# Navigate to project root
cd /Users/alex/Downloads/delviery-main

# Deploy migrations
supabase db push

# Or if using Supabase CLI locally
supabase migration up
```

**Expected Output:**
- Migration `20250115000002_enhance_stock_zero_notifications.sql` applied
- Migration `20250115000003_audit_triggers_critical_operations.sql` applied
- Triggers created successfully
- Functions created successfully

### Step 2: Verify Migrations

```sql
-- Check if triggers exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_notify_stock_zero',
  'trigger_audit_products',
  'trigger_audit_orders',
  'trigger_audit_wholesale_orders',
  'trigger_audit_tenants',
  'trigger_audit_tenant_users'
);

-- Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'notify_stock_zero',
  'log_audit_trail'
);
```

### Step 3: Deploy Frontend Changes

```bash
# Build production bundle
npm run build

# Deploy to your hosting platform (Vercel, Netlify, etc.)
# Or test locally
npm run preview
```

### Step 4: Test Functionality

#### Test 1: Real-time Super Admin Dashboard
1. Open super admin dashboard
2. In another tab/window, update a tenant's subscription plan
3. **Expected:** Dashboard updates automatically without refresh

#### Test 2: Real-time Subscription Tier Changes
1. Log in as tenant admin
2. In super admin panel, change tenant's subscription plan
3. **Expected:** Tenant admin context refreshes automatically, features unlock/lock

#### Test 3: Stock-Zero Notifications
1. Create or update a product with stock > 0
2. Update product to set `available_quantity = 0`
3. **Expected:**
   - Product removed from menus (existing trigger)
   - Activity log entry created
   - Inventory alert created (if using wholesale_inventory)

#### Test 4: Audit Triggers
1. Create a new product
2. Update the product
3. Delete the product (if allowed)
4. **Expected:**
   - Audit log entries in `audit_trail` table
   - Activity log entries in `activity_logs` table
   - Actor type correctly identified

---

## 🔍 Verification Queries

### Check Real-time Subscriptions
```sql
-- Check active real-time subscriptions (if using Supabase Realtime)
SELECT * FROM pg_stat_activity 
WHERE application_name LIKE '%realtime%';
```

### Check Audit Logs
```sql
-- View recent audit logs
SELECT 
  actor_type,
  action,
  resource_type,
  created_at
FROM audit_trail
ORDER BY created_at DESC
LIMIT 10;

-- View recent activity logs
SELECT 
  action,
  resource,
  created_at
FROM activity_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Check Stock-Zero Notifications
```sql
-- View recent stock-zero events
SELECT 
  action,
  resource,
  metadata->>'product_name' as product_name,
  created_at
FROM activity_logs
WHERE action = 'product_out_of_stock'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ⚠️ Potential Issues & Solutions

### Issue 1: Real-time Subscription Not Connecting
**Symptoms:** Dashboard doesn't update automatically

**Solutions:**
- Check Supabase Realtime is enabled for `tenants` and `subscription_events` tables
- Verify RLS policies allow reading these tables
- Check browser console for WebSocket errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly

### Issue 2: Audit Triggers Not Firing
**Symptoms:** No audit log entries created

**Solutions:**
- Verify triggers exist: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%audit%'`
- Check function exists: `SELECT * FROM information_schema.routines WHERE routine_name = 'log_audit_trail'`
- Verify tables exist: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('audit_trail', 'activity_logs')`
- Check function permissions: `GRANT EXECUTE ON FUNCTION log_audit_trail() TO authenticated;`

### Issue 3: Stock-Zero Notification Not Creating Alerts
**Symptoms:** No inventory alerts when stock reaches zero

**Solutions:**
- Note: `inventory_alerts` references `wholesale_inventory`, not `products`
- Stock-zero trigger logs to `activity_logs` instead
- If you need alerts for `products`, create a separate table or modify the reference

### Issue 4: TypeScript Errors
**Symptoms:** Build fails with TypeScript errors

**Solutions:**
- Run `npx tsc --noEmit` to see all errors
- Check import paths use `@/` alias
- Verify all types are imported correctly
- Check for missing dependencies

---

## 📊 Post-Deployment Monitoring

### Monitor Real-time Connections
- Check Supabase dashboard for active real-time connections
- Monitor WebSocket connection errors in browser console
- Track subscription success/failure rates

### Monitor Audit Logs
- Check `audit_trail` table size (may grow quickly)
- Monitor `activity_logs` table size
- Set up alerts for unusual activity patterns

### Monitor Performance
- Check trigger execution time (should be < 10ms)
- Monitor query performance on audited tables
- Watch for any slowdowns in product/order operations

---

## 🔄 Rollback Plan

If issues occur, you can rollback:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trigger_notify_stock_zero ON public.products;
DROP TRIGGER IF EXISTS trigger_audit_products ON public.products;
DROP TRIGGER IF EXISTS trigger_audit_orders ON public.orders;
DROP TRIGGER IF EXISTS trigger_audit_wholesale_orders ON public.wholesale_orders;
DROP TRIGGER IF EXISTS trigger_audit_tenants ON public.tenants;
DROP TRIGGER IF EXISTS trigger_audit_tenant_users ON public.tenant_users;

-- Remove functions (optional - keep for future use)
-- DROP FUNCTION IF EXISTS public.notify_stock_zero();
-- DROP FUNCTION IF EXISTS public.log_audit_trail();
```

**Note:** Frontend changes (real-time subscriptions) will continue to work but won't receive updates. You can remove the `useEffect` hooks if needed.

---

## ✅ Success Criteria

- [ ] All migrations applied successfully
- [ ] All triggers created and active
- [ ] Real-time subscriptions working
- [ ] Audit logs being created
- [ ] Stock-zero notifications working
- [ ] No performance degradation
- [ ] No errors in logs

---

**Status:** Ready for deployment

**Next Steps:** Deploy migrations and test functionality

