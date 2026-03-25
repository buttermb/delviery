# Email Verification Troubleshooting Guide

## Problem
"Failed to send a request to the Edge Function" error when clicking "Resend Verification Email"

## Required Environment Variables

The following environment variables must be set in your Supabase project:

### 1. In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
# Required for email sending
RESEND_API_KEY=re_xxxxx...

# Site URL for email links (e.g., https://yourdomain.com or http://localhost:5173 for dev)
SITE_URL=https://yourdomain.com

# Automatically set by Supabase (verify they exist)
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Deployment Steps

### 1. Install Supabase CLI (if not installed)
```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### 2. Link to your project
```bash
supabase link --project-ref mtvwmyerntkhrcdnhahp
```

### 3. Deploy the required functions
```bash
# Deploy the resend verification function
supabase functions deploy resend-admin-verification

# Deploy the email sending function (dependency)
supabase functions deploy send-klaviyo-email
```

### 4. Set environment variables
```bash
# Set RESEND_API_KEY (get from https://resend.com/api-keys)
supabase secrets set RESEND_API_KEY=re_xxxxx...

# Set SITE_URL
supabase secrets set SITE_URL=https://yourdomain.com
```

## Testing Locally

### 1. Start Supabase locally
```bash
supabase start
```

### 2. Create .env.local with secrets
```bash
RESEND_API_KEY=re_xxxxx...
SITE_URL=http://localhost:5173
```

### 3. Serve functions locally
```bash
supabase functions serve --env-file .env.local
```

### 4. Test the function
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/resend-admin-verification' \
  --header 'Authorization: Bearer YOUR_SESSION_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","tenant_slug":"test-tenant"}'
```

## Common Issues

### Issue 1: "Missing authorization" error
**Cause:** User is not logged in or session expired
**Fix:** Ensure user is authenticated before calling the function. The improved code now checks for session before calling.

### Issue 2: "Email service not configured" error
**Cause:** RESEND_API_KEY is not set
**Fix:** Set the environment variable in Supabase Dashboard → Edge Functions → Secrets

### Issue 3: "Failed to generate verification link" error
**Cause:** Supabase auth admin API issue
**Fix:** Verify SUPABASE_SERVICE_ROLE_KEY is set correctly

### Issue 4: "Failed to send verification email" error
**Cause:** send-klaviyo-email function failed
**Fix:**
1. Verify send-klaviyo-email is deployed
2. Check its logs: `supabase functions logs send-klaviyo-email`
3. Ensure RESEND_API_KEY is valid

### Issue 5: Network error / CORS issue
**Cause:** Function not deployed or CORS misconfigured
**Fix:** Redeploy the function and verify config.toml has correct settings

## Verification Checklist

- [ ] Supabase CLI is installed
- [ ] Project is linked (`supabase link`)
- [ ] Functions are deployed
  - [ ] `resend-admin-verification`
  - [ ] `send-klaviyo-email`
- [ ] Environment variables are set
  - [ ] `RESEND_API_KEY`
  - [ ] `SITE_URL`
- [ ] User is authenticated (session exists)
- [ ] Browser console shows detailed error logs
- [ ] Edge function logs checked (`supabase functions logs`)

## Getting More Information

### Check browser console
The improved code now logs:
- `[VERIFY_EMAIL] Invoking resend-admin-verification for: <email>`
- `[VERIFY_EMAIL] Response: {data, error}`
- `[VERIFY_EMAIL] Edge function error: <details>`

### Check edge function logs
```bash
# Recent logs for resend-admin-verification
supabase functions logs resend-admin-verification --tail

# Recent logs for send-klaviyo-email
supabase functions logs send-klaviyo-email --tail
```

### Test with curl
Get your session token from browser DevTools → Application → Local Storage → `sb-<project-ref>-auth-token`

```bash
curl -i --location --request POST 'https://mtvwmyerntkhrcdnhahp.supabase.co/functions/v1/resend-admin-verification' \
  --header 'Authorization: Bearer YOUR_SESSION_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"email":"your-email@example.com","tenant_slug":"your-tenant"}'
```
