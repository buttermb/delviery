# Security Settings Configuration Guide

## Manual Configuration Required

Some security settings must be configured in the Supabase Dashboard and cannot be automated via migrations.

## Leaked Password Protection

**Status:** 🔴 **CRITICAL - MUST ENABLE**

**Issue:** Users can use compromised passwords from data breaches, leading to account takeovers.

**Fix Location:** Supabase Dashboard → Authentication → Password Settings

### Steps to Enable:

1. Navigate to your Supabase project dashboard
2. Go to **Authentication** in the left sidebar
3. Click on **Password** settings
4. Enable the option: **"Check passwords against breach database"**
5. Optionally enable: **"Reject common passwords"**
6. Click **Save**

### What This Does:

- Checks user passwords against known data breach databases (Have I Been Pwned)
- Prevents users from using compromised passwords
- Reduces risk of account takeover attacks
- Automatically validates during signup and password reset

### Recommended Settings:

```
✅ Check passwords against breach database: ENABLED
✅ Reject common passwords: ENABLED
✅ Minimum password length: 8 characters (or higher)
✅ Require uppercase: Recommended
✅ Require lowercase: Recommended
✅ Require numbers: Recommended
✅ Require special characters: Recommended
```

## Additional Security Settings

### Session Management

**Location:** Authentication → Sessions

**Recommended:**
- Session timeout: 7 days (or shorter for sensitive operations)
- Enable refresh token rotation: YES
- Enable email confirmation: YES
- Enable phone confirmation: YES (if using phone auth)

### Rate Limiting

**Location:** Authentication → Rate Limits

**Recommended:**
- Enable rate limiting: YES
- Login attempts: 5 per hour per IP
- Signup attempts: 3 per hour per IP
- Password reset: 3 per hour per email

### Email Templates

**Location:** Authentication → Email Templates

**Security Best Practices:**
- Use branded email templates (reduces phishing risk)
- Include security warnings in emails
- Add "If you didn't request this" warnings

### Two-Factor Authentication

**Location:** Authentication → 2FA Settings

**Recommended:**
- Enable 2FA: YES
- Require 2FA for admin users: YES
- Backup codes: Generate and store securely

## Verification Checklist

After configuring:

- [ ] Leaked password protection enabled
- [ ] Common passwords rejected
- [ ] Rate limiting configured
- [ ] Session timeout set appropriately
- [ ] Email confirmation required
- [ ] 2FA available (and required for admins)
- [ ] Security event logging enabled

## Related Files

- `supabase/migrations/20251106000002_fix_public_read_policies.sql` - RLS policy fixes
- `supabase/migrations/20251106000001_fix_tenant_users_rls_recursion.sql` - Security function fixes

## Important Notes

- These settings are managed in Supabase Dashboard, not in code
- Changes take effect immediately
- Review settings after each major release
- Document any custom security configurations

