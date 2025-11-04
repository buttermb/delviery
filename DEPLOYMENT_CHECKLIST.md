# Deployment Checklist

Step-by-step guide to deploy all the new features and fixes.

## Prerequisites

- [ ] Supabase CLI installed and configured
- [ ] Database access configured
- [ ] Supabase project linked
- [ ] Environment variables set up

---

## Step 1: Database Migrations

Apply all new migrations to the database:

```bash
# Review migrations first
ls -la supabase/migrations/20250101*

# Apply migrations (in order)
supabase db push

# Or apply manually:
# 1. 20250101000000_add_billing_rpc_functions.sql
# 2. 20250101000001_create_activity_logs_table.sql
# 3. 20250101000002_add_invoice_rpc_functions.sql
```

**Verify**:
- [ ] `get_tenant_billing()` function exists
- [ ] `get_white_label_config()` function exists
- [ ] `get_payment_methods()` function exists
- [ ] `activity_logs` table exists
- [ ] `log_activity()` function exists
- [ ] `get_tenant_invoices()` function exists
- [ ] `get_invoice()` function exists
- [ ] `generate_invoice_number()` function exists

**Check**:
```sql
-- Verify RPC functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_tenant_billing',
  'get_white_label_config',
  'get_payment_methods',
  'log_activity',
  'get_tenant_invoices',
  'get_invoice',
  'generate_invoice_number'
);

-- Verify activity_logs table
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'activity_logs';

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'activity_logs';
```

---

## Step 2: Deploy Edge Functions

Deploy all new Edge Functions:

```bash
# Deploy new functions
supabase functions deploy billing
supabase functions deploy staff-management
supabase functions deploy invoice-management
supabase functions deploy panic-reset

# Update existing functions
supabase functions deploy tenant-invite
supabase functions deploy stripe-customer-portal
```

**Verify**:
- [ ] All functions show "Deployed successfully"
- [ ] Functions appear in Supabase dashboard
- [ ] No deployment errors

**Check**:
```bash
# List all functions
supabase functions list

# Check function logs
supabase functions logs billing
```

---

## Step 3: Environment Variables

Ensure all required environment variables are set:

**Supabase Edge Functions** (set in Supabase Dashboard):
- `SUPABASE_URL` ✅ (usually auto-set)
- `SUPABASE_ANON_KEY` ✅ (usually auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (usually auto-set)
- `STRIPE_SECRET_KEY` (for stripe-customer-portal)
- `SITE_URL` (for return URLs)

**Frontend** (set in `.env`):
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY` ✅

---

## Step 4: Test Edge Functions

Test each Edge Function with proper authentication:

### Test billing
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/billing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_billing", "tenant_id": "YOUR_TENANT_ID"}'
```

### Test staff-management
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/staff-management \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "list", "tenant_id": "YOUR_TENANT_ID"}'
```

### Test invoice-management
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/invoice-management \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "list", "tenant_id": "YOUR_TENANT_ID"}'
```

### Test panic-reset (Super Admin only)
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/panic-reset \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "preview", "tenant_id": "YOUR_TENANT_ID"}'
```

**Verify**:
- [ ] All functions return 200 status
- [ ] No 401/403 errors
- [ ] Response format is correct
- [ ] Error handling works

---

## Step 5: Frontend Testing

Test all updated pages:

### Authentication
- [ ] Login as tenant admin
- [ ] Verify Edge Functions receive auth tokens
- [ ] Check browser console for errors

### Real-Time Sync
- [ ] Open POS System
- [ ] Make a sale in another tab
- [ ] Verify POS updates automatically
- [ ] Test Fleet Management real-time updates
- [ ] Test Inventory real-time updates
- [ ] Test Financial Center real-time updates

### Activity Logging
- [ ] Complete a sale in POS
- [ ] Check `activity_logs` table
- [ ] Verify activities are logged correctly

### Invoice Management
- [ ] Create invoice via CustomerInvoices page
- [ ] Verify invoice appears in list
- [ ] Test invoice update
- [ ] Test invoice deletion (draft only)

### Billing Page
- [ ] Load billing page
- [ ] Verify invoices load correctly
- [ ] Check payment methods (if any)

### Panic Reset Tool
- [ ] Login as super admin
- [ ] Navigate to Tools page
- [ ] Test preview functionality
- [ ] ⚠️ **DO NOT test reset in production**

---

## Step 6: Verify RLS Policies

Check that Row Level Security is working:

```sql
-- Test as regular user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'USER_ID_HERE';

-- Should only see own data
SELECT * FROM activity_logs WHERE user_id = 'USER_ID_HERE';

-- Should NOT see other users' data
SELECT * FROM activity_logs WHERE user_id != 'USER_ID_HERE'; -- Should return empty
```

**Verify**:
- [ ] RLS policies are active
- [ ] Users can only see their own data
- [ ] Admins can see tenant data
- [ ] Super admins can see all data

---

## Step 7: Performance Check

Verify performance is acceptable:

- [ ] Edge Functions respond in < 2 seconds
- [ ] RPC functions execute in < 1 second
- [ ] Real-time updates appear within 1 second
- [ ] No N+1 query problems
- [ ] Database indexes are being used

**Check**:
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM activity_logs WHERE tenant_id = 'TENANT_ID';

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('activity_logs', 'invoices')
ORDER BY idx_scan DESC;
```

---

## Step 8: Error Monitoring

Set up error monitoring:

- [ ] Check Supabase Edge Function logs
- [ ] Monitor browser console for errors
- [ ] Set up alerts for 500 errors
- [ ] Monitor RPC function errors

**Locations**:
- Supabase Dashboard → Edge Functions → Logs
- Browser DevTools → Console
- Supabase Dashboard → Database → Logs

---

## Step 9: Documentation

Update team documentation:

- [ ] Share `EDGE_FUNCTIONS_REFERENCE.md`
- [ ] Share `IMPLEMENTATION_SUMMARY.md`
- [ ] Update API documentation
- [ ] Update developer onboarding docs

---

## Step 10: Rollback Plan

If something goes wrong:

### Rollback Edge Functions
```bash
# Redeploy previous version
supabase functions deploy FUNCTION_NAME --version PREVIOUS_VERSION
```

### Rollback Migrations
```sql
-- Drop new functions
DROP FUNCTION IF EXISTS get_tenant_billing(uuid);
DROP FUNCTION IF EXISTS get_white_label_config(uuid);
DROP FUNCTION IF EXISTS get_payment_methods(uuid);
DROP FUNCTION IF EXISTS log_activity(uuid, uuid, text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS get_tenant_invoices(uuid);
DROP FUNCTION IF EXISTS get_invoice(uuid);
DROP FUNCTION IF EXISTS generate_invoice_number(uuid);

-- Drop activity_logs table (if needed)
DROP TABLE IF EXISTS activity_logs CASCADE;
```

---

## Post-Deployment

After deployment:

- [ ] Monitor error rates for 24 hours
- [ ] Check user feedback
- [ ] Verify all features working
- [ ] Update status page (if applicable)
- [ ] Notify team of successful deployment

---

## Troubleshooting

### Edge Function returns 401
- Check JWT token is valid
- Verify token is being passed in Authorization header
- Check user has proper tenant access

### Edge Function returns JSON coercion error
- Verify RPC function exists
- Check RPC function returns single JSON object
- Use fallback to direct query if needed

### Real-time not working
- Check Supabase Realtime is enabled
- Verify channel subscriptions are active
- Check browser console for connection errors

### Activity logs not appearing
- Verify `activity_logs` table exists
- Check RLS policies allow inserts
- Verify `log_activity()` function exists

---

## Success Criteria

✅ All migrations applied successfully
✅ All Edge Functions deployed
✅ No authentication errors
✅ Real-time sync working
✅ Activity logging functional
✅ Invoice management working
✅ All pages load without errors
✅ No console errors in browser
✅ Performance is acceptable

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Status**: ⬜ In Progress / ⬜ Complete / ⬜ Failed
