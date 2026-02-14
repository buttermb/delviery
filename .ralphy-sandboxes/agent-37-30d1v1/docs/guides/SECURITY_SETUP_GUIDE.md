# 🔐 Security Setup Guide - Manual Steps

## ⚠️ Important: Manual Configuration Required

After running the migration, you need to manually enable some security features in the Supabase Dashboard.

---

## Step 1: Enable Leaked Password Protection

### Location
Supabase Dashboard → Your Project → Authentication → Settings

### Steps
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `vltveasdxtfvvqbzxzuf`
3. Navigate to **Authentication** → **Settings**
4. Scroll to "Leaked Password Protection"
5. Toggle **ON**
6. Click "Save"

### What This Does
- Checks new passwords against breached databases
- Blocks compromised passwords
- Protects user accounts
- Requires strong passwords

---

## Step 2: Configure Password Requirements

### Location
Supabase Dashboard → Authentication → Settings

### Settings
1. **Minimum Length:** 8 characters
2. **Require Uppercase:** Yes
3. **Require Lowercase:** Yes
4. **Require Numbers:** Yes
5. **Require Special Characters:** Yes
6. **Leaked Password Check:** Enabled

### How to Apply
1. Dashboard → Authentication → Settings
2. Find "Password Requirements"
3. Configure as above
4. Save settings

---

## Step 3: Apply Database Migration

### Option A: Using Supabase CLI (Local)
```bash
# From your project directory
cd /Users/alex/Documents/GitHub/bud-dash-nyc
supabase migration up
```

### Option B: Using Supabase Dashboard
1. Go to Database → Migrations
2. Click "New Migration"
3. Copy contents of `supabase/migrations/20250103000000_security_fixes.sql`
4. Paste and apply

### Option C: Push to Remote
```bash
supabase db push
```

---

## Step 4: Test Security Features

### Test 1: Weak Password (Should Fail)
```bash
# Try to sign up with weak password
curl -X POST https://vltveasdxtfvvqbzxzuf.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "weakpass"
  }'
```

**Expected:** Error - "Password does not meet requirements"

### Test 2: Leaked Password (Should Fail)
```bash
curl -X POST https://vltveasdxtfvvqbzxzuf.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "password123"
  }'
```

**Expected:** Error - "This password has been found in a data breach"

### Test 3: Strong Password (Should Pass)
```bash
curl -X POST https://vltveasdxtfvvqbzxzuf.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test3@example.com",
    "password": "Str0ng!P@ss"
  }'
```

**Expected:** Success - Account created

---

## Step 5: Verify Security Functions

### Check Password Strength Function
```sql
-- Test the function
SELECT check_password_strength('weakpass'); -- Returns FALSE
SELECT check_password_strength('Str0ng!P@ss'); -- Returns TRUE
```

### Check Audit Function
```sql
-- View recent security events
SELECT * FROM security_events 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Step 6: Monitor Security Events

### View in Dashboard
1. Go to Database → Table Editor
2. Select `security_events` table
3. View logged events

### Query Events
```sql
-- Check user activity
SELECT 
  user_id,
  event_type,
  entity_type,
  details,
  created_at
FROM security_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🔍 Security Checklist

### Completed ✅
- [x] Migration file created
- [x] Password strength function added
- [x] Audit logging enabled
- [x] Secure function execution
- [x] Search path security
- [x] Client configuration updated

### Manual Steps Required ⚠️
- [ ] Enable leaked password protection in dashboard
- [ ] Configure password requirements
- [ ] Apply database migration
- [ ] Test weak password rejection
- [ ] Test strong password acceptance
- [ ] Verify audit logging works

---

## 📊 What's Protected Now

### Authentication Security
- ✅ Password strength validation
- ✅ Leaked password blocking
- ✅ Secure session management
- ✅ PKCE flow enabled
- ✅ Auto token refresh

### Database Security
- ✅ Secure function execution
- ✅ Search path isolation
- ✅ Proper permissions
- ✅ Audit trail logging

### User Protection
- ✅ Strong password requirements
- ✅ Breach detection
- ✅ Activity monitoring
- ✅ IP address logging

---

## 🚨 Important Security Notes

1. **Never disable these settings**
2. **Monitor security_events regularly**
3. **Review failed login attempts**
4. **Update passwords periodically**
5. **Use strong passwords yourself**

---

## 📞 Support

If you need help:
1. Check `SECURITY_ENHANCEMENTS.md` for details
2. Review migration file comments
3. Check Supabase Dashboard logs
4. Test with curl commands above

---

**Status:** Security Infrastructure Ready! ⚠️ Manual Steps Required  
**Next:** Enable features in Supabase Dashboard  
**Repository:** https://github.com/buttermb/bud-dash-nyc


