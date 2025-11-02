# 🚀 Onboarding System - Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migrations
Run these migrations **in order** before deploying:

```bash
# Migration 1: Onboarding Tracking
supabase/migrations/20251107000000_add_onboarding_tracking.sql

# Migration 2: Commission Tracking
supabase/migrations/20251107000001_add_commission_tracking.sql
```

**SQL Execution Order:**
```sql
-- 1. Add onboarding columns to tenants table
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_data_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tooltips_dismissed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tooltips_dismissed_at TIMESTAMPTZ;

-- 2. Create feature_usage table
CREATE TABLE IF NOT EXISTS feature_usage (...);

-- 3. Create commission_transactions table
CREATE TABLE IF NOT EXISTS commission_transactions (...);

-- 4. Create commission trigger function
CREATE OR REPLACE FUNCTION calculate_commission() ...;

-- 5. Create triggers
CREATE TRIGGER order_commission_trigger ...;
```

### 2. Edge Function Deployment
Deploy the updated `tenant-admin-auth` function:

```bash
supabase functions deploy tenant-admin-auth
```

**Verify the function includes:**
- `setup-password` action
- Proper CORS headers
- Error handling for all actions

### 3. Environment Variables
Ensure these are set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database RLS Policies
Verify Row Level Security is configured:

```sql
-- commission_transactions RLS
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Policies should allow:
-- 1. Tenants to view their own commissions
-- 2. System to insert via trigger
-- 3. Super admins to view all
```

---

## Deployment Steps

### Step 1: Backup Database
```bash
supabase db dump -f backup_before_onboarding.sql
```

### Step 2: Run Migrations
```bash
# Using Supabase CLI
supabase migration up

# Or manually in Supabase Dashboard:
# SQL Editor → Paste migration files → Run
```

### Step 3: Deploy Edge Function
```bash
supabase functions deploy tenant-admin-auth
```

### Step 4: Deploy Frontend
```bash
npm run build
# Deploy to your hosting platform (Vercel, Netlify, etc.)
```

### Step 5: Verify Deployment
Test the complete flow:

1. ✅ Visit `/saas/signup`
2. ✅ Fill form and submit
3. ✅ Should redirect to `/:tenantSlug/admin/welcome`
4. ✅ Welcome page loads without requiring login
5. ✅ Click "Use Demo Data" → Data generates successfully
6. ✅ Progress updates correctly
7. ✅ Complete all steps → Confetti animation
8. ✅ Navigate to dashboard → All widgets display

---

## Post-Deployment Verification

### Database Checks
```sql
-- Check onboarding columns exist
SELECT onboarding_completed, demo_data_generated, tooltips_dismissed 
FROM tenants 
LIMIT 1;

-- Check commission_transactions table exists
SELECT COUNT(*) FROM commission_transactions;

-- Check feature_usage table exists
SELECT COUNT(*) FROM feature_usage;
```

### Edge Function Checks
```bash
# Test setup-password action
curl -X POST https://your-project.supabase.co/functions/v1/tenant-admin-auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "setup-password",
    "email": "test@example.com",
    "password": "testpassword123",
    "tenantSlug": "test-tenant"
  }'
```

### Frontend Checks
1. ✅ All routes accessible
2. ✅ Navigation sidebar works
3. ✅ Dashboard loads correctly
4. ✅ Demo data generation works
5. ✅ Progress tracking updates
6. ✅ Mobile responsive

---

## Error Handling Notes

### Password Setup Failures
**Scenario:** Edge Function fails to set password hash during signup.

**Handling:**
- Signup continues anyway (non-blocking)
- User can still access welcome page
- User can set password later via login page
- Error logged for monitoring

**User Experience:**
- Account created successfully
- Redirected to welcome page
- Can complete onboarding
- May need to use "Forgot Password" flow later

### Demo Data Generation Failures
**Scenario:** Error generating demo data.

**Handling:**
- Error caught and displayed via toast
- User can retry
- Manual data entry still available
- Progress tracking unaffected

**User Experience:**
- Toast notification: "Failed to generate demo data"
- "Use Demo Data" button remains available
- Can complete onboarding manually

### Edge Function Unavailable
**Scenario:** Edge Function not deployed or URL incorrect.

**Handling:**
- Password setup fails silently
- Signup still succeeds
- User redirected to welcome page
- Password can be set later

**Mitigation:**
- Monitor Edge Function logs
- Set up alerts for function failures
- Provide manual password reset option

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Signup Success Rate**
   - Target: > 95%
   - Alert if: < 90%

2. **Password Setup Success Rate**
   - Target: > 98%
   - Alert if: < 95%

3. **Demo Data Generation Success**
   - Target: > 90%
   - Alert if: < 85%

4. **Onboarding Completion Rate**
   - Target: > 60%
   - Alert if: < 50%

### Log Monitoring
Monitor these in Supabase Dashboard → Logs:

1. **Edge Function Logs**
   ```
   tenant-admin-auth function
   - Look for "setup-password" action errors
   - Monitor response times
   ```

2. **Database Logs**
   ```
   - Commission trigger execution
   - Onboarding status updates
   - Demo data inserts
   ```

3. **Frontend Errors**
   ```
   - Console errors in browser
   - Network request failures
   - Component render errors
   ```

---

## Rollback Plan

If issues occur after deployment:

### 1. Rollback Frontend
```bash
git revert <commit-hash>
npm run build
# Redeploy frontend
```

### 2. Rollback Migrations (if needed)
```sql
-- Remove onboarding columns (if causing issues)
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS onboarding_completed,
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS demo_data_generated,
  DROP COLUMN IF EXISTS tooltips_dismissed,
  DROP COLUMN IF EXISTS tooltips_dismissed_at;

-- Drop tables (if needed)
DROP TABLE IF EXISTS commission_transactions;
DROP TABLE IF EXISTS feature_usage;

-- Drop triggers
DROP TRIGGER IF EXISTS order_commission_trigger ON menu_orders;
DROP FUNCTION IF EXISTS calculate_commission();
```

### 3. Disable Edge Function Action
Temporarily disable `setup-password` action by adding early return:

```typescript
if (action === "setup-password") {
  return new Response(
    JSON.stringify({ error: "Temporarily disabled" }),
    { status: 503, headers: corsHeaders }
  );
}
```

---

## Troubleshooting

### Issue: Welcome Page Not Accessible
**Symptom:** Redirected to login after signup.

**Solution:**
1. Check `TenantAdminProtectedRoute` allows `/welcome` route
2. Verify `location.state` contains tenant data
3. Check browser console for errors

### Issue: Password Setup Failing
**Symptom:** Users can't log in after signup.

**Solution:**
1. Check Edge Function logs
2. Verify function is deployed
3. Check `VITE_SUPABASE_URL` is correct
4. Test function manually via curl

### Issue: Demo Data Not Generating
**Symptom:** Clicking "Use Demo Data" fails.

**Solution:**
1. Check database permissions for inserts
2. Verify `tenant_id` columns exist
3. Check console for specific error
4. Verify user has INSERT permissions

### Issue: Commission Not Calculating
**Symptom:** Dashboard shows $0 commission.

**Solution:**
1. Verify trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'order_commission_trigger';`
2. Check trigger function exists
3. Verify orders are being confirmed
4. Check `commission_transactions` table has data

---

## Support Contacts

- **Technical Issues:** [Your Support Email]
- **Database Issues:** [DBA Contact]
- **Edge Function Issues:** [DevOps Contact]

---

**Last Updated:** 2025-01-07
**Version:** 1.0.0

