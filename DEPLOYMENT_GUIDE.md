# Deployment Guide - Complete Fix Implementation

## 🎯 Pre-Deployment Checklist

### ✅ Code Status
- ✅ All Edge Functions created and fixed
- ✅ Signup flow uses Edge Function
- ✅ Build successful (no TypeScript errors)
- ✅ Routes configured correctly
- ✅ Error handling in place

### ⚠️ Required Actions Before Deployment

1. **Deploy Edge Functions** (CRITICAL)
2. **Configure Environment Variables**
3. **Test Signup → Login Flow**
4. **Create Test Tenant** (for initial testing)

---

## 📦 Step 1: Deploy Edge Functions

### Deploy to Supabase

```bash
# Navigate to project root
cd /path/to/delviery-main

# Deploy all authentication Edge Functions
supabase functions deploy tenant-signup
supabase functions deploy tenant-admin-auth
supabase functions deploy super-admin-auth
supabase functions deploy customer-auth
```

### Verify Deployment

1. **Check Supabase Dashboard**:
   - Go to: `https://app.supabase.com/project/YOUR_PROJECT/functions`
   - Verify all 4 functions are listed:
     - ✅ `tenant-signup`
     - ✅ `tenant-admin-auth`
     - ✅ `super-admin-auth`
     - ✅ `customer-auth`

2. **Test Edge Functions** (via Dashboard):
   - Click on `tenant-signup`
   - Use "Test" tab
   - Try a test request:
   ```json
   {
     "email": "test@example.com",
     "password": "testpassword123",
     "business_name": "Test Business",
     "owner_name": "Test Owner",
     "phone": "1234567890",
     "state": "CA",
     "industry": "retail",
     "company_size": "1-10"
   }
   ```
   - Should return: `{ "success": true, "tenant": {...}, "user": {...} }`

---

## 🔧 Step 2: Environment Variables

### Required Environment Variables

Edge Functions need these (usually auto-configured by Supabase):

- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

**Note**: These are automatically available in Edge Functions when deployed to Supabase.

### Frontend Environment Variables

Make sure your frontend `.env` file has:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🧪 Step 3: Test Complete Flow

### Test Signup Flow

1. **Navigate to signup page**:
   ```
   https://your-domain.com/signup
   ```

2. **Fill out form**:
   - Business name: "Test Business"
   - Owner name: "Test Owner"
   - Email: "test@example.com"
   - Password: "testpassword123"
   - Phone, State, Industry, Company Size
   - Accept terms

3. **Submit form**:
   - ✅ Should show "Account Created!" toast
   - ✅ Should redirect to `/saas/login?signup=success&tenant=test-business`
   - ✅ Login page should show success message

4. **Verify in database** (Supabase Dashboard):
   ```sql
   SELECT * FROM tenants WHERE slug = 'test-business';
   SELECT * FROM tenant_users WHERE email = 'test@example.com';
   ```
   - Should see new tenant and tenant_user records

### Test Login Flow

1. **Navigate to login**:
   ```
   https://your-domain.com/test-business/admin/login
   ```

2. **Enter credentials**:
   - Email: `test@example.com`
   - Password: `testpassword123`

3. **Submit**:
   - ✅ Should authenticate successfully
   - ✅ Should redirect to `/test-business/admin/dashboard`
   - ✅ Dashboard should load

---

## 🐛 Troubleshooting

### Edge Function Returns 404

**Problem**: `Edge Function not found`

**Solutions**:
1. Verify function is deployed:
   ```bash
   supabase functions list
   ```

2. Check function name matches exactly:
   - Code: `supabase.functions.invoke('tenant-signup')`
   - Deployed: Must be named `tenant-signup`

3. Redeploy if needed:
   ```bash
   supabase functions deploy tenant-signup
   ```

### Signup Returns "Edge Function Error"

**Problem**: Edge Function call fails

**Check**:
1. **Edge Function logs** (Supabase Dashboard):
   - Go to: `Project → Logs → Edge Functions`
   - Look for errors in `tenant-signup` logs

2. **Common Issues**:
   - Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable
   - RLS policies blocking service role (shouldn't happen)
   - Database connection issues

3. **Verify service role key**:
   - Go to: `Project → Settings → API`
   - Copy `service_role` key
   - Verify it's available in Edge Function environment

### Login Fails After Signup

**Problem**: Can't login with new account

**Check**:
1. **Verify auth user created**:
   ```sql
   SELECT * FROM auth.users WHERE email = 'test@example.com';
   ```
   - Should exist if signup succeeded

2. **Verify tenant_user created**:
   ```sql
   SELECT * FROM tenant_users WHERE email = 'test@example.com';
   ```
   - Should have `status = 'active'`
   - Should have `password_hash` set

3. **Check Edge Function logs**:
   - Look at `tenant-admin-auth` logs
   - Check for authentication errors

### "Tenant not found" Error

**Problem**: Login says tenant doesn't exist

**Check**:
1. **Verify tenant slug**:
   - URL should match slug in database
   - Slug is lowercase, hyphens only

2. **Check tenant exists**:
   ```sql
   SELECT slug, business_name FROM tenants;
   ```
   - Verify slug matches URL

---

## 📊 Verification Queries

### Check Signup Worked

```sql
-- Check tenant created
SELECT id, slug, business_name, owner_email, subscription_status 
FROM tenants 
ORDER BY created_at DESC 
LIMIT 5;

-- Check tenant_user created
SELECT id, email, name, role, status, tenant_id
FROM tenant_users 
ORDER BY created_at DESC 
LIMIT 5;

-- Check auth user created
SELECT id, email, email_confirmed_at, created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Trial Period

```sql
-- Verify trial_ends_at is set correctly (14 days from now)
SELECT 
  business_name,
  subscription_status,
  trial_ends_at,
  trial_ends_at - NOW() as days_remaining
FROM tenants
WHERE subscription_status = 'trial'
ORDER BY created_at DESC;
```

---

## 🔄 Rollback Plan

If something goes wrong:

1. **Revert Edge Functions**:
   ```bash
   # Deploy previous version if needed
   supabase functions deploy tenant-signup --version previous
   ```

2. **Clean up test data**:
   ```sql
   -- Delete test tenant (if needed)
   DELETE FROM tenant_users WHERE email = 'test@example.com';
   DELETE FROM tenants WHERE slug = 'test-business';
   DELETE FROM auth.users WHERE email = 'test@example.com';
   ```

3. **Check logs**:
   - Review Edge Function logs
   - Check browser console
   - Check Supabase Dashboard logs

---

## ✅ Success Criteria

After deployment, verify:

- [ ] All 4 Edge Functions deployed successfully
- [ ] Signup creates tenant and user
- [ ] Login works with new account
- [ ] Dashboard loads after login
- [ ] No errors in Edge Function logs
- [ ] No errors in browser console
- [ ] Database records created correctly

---

## 📞 Support

If you encounter issues:

1. **Check Edge Function logs** in Supabase Dashboard
2. **Check browser console** for client-side errors
3. **Verify environment variables** are set correctly
4. **Review this guide** for troubleshooting steps

---

**Last Updated**: After complete fix implementation
**Status**: ✅ Ready for Deployment
