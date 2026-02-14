# CSP Debug Notes - Connection Issues

**Date:** 2025-01-28  
**Status:** ⚠️ Site still not connecting after CSP fix  
**Action:** User reverting changes

---

## What We Tried

### CSP Fixes Applied:
1. ✅ Changed from specific domain to `*.supabase.co` wildcard
2. ✅ Added Vite HMR WebSocket support (`ws://localhost:*`)
3. ✅ Removed `upgrade-insecure-requests` in dev mode
4. ✅ Added `wss://*.supabase.co` for Realtime WebSocket

### Files Modified:
- `index.html` - CSP meta tag
- `vite.config.ts` - Dev server headers
- `public/_headers` - Netlify headers
- `vercel.json` - Vercel headers

---

## Possible Remaining Issues

### 1. Environment Variables
- Check if `VITE_SUPABASE_URL` is set correctly
- Check if `VITE_SUPABASE_ANON_KEY` is set
- Verify `.env` file exists and is loaded

### 2. Supabase Connection
- Verify Supabase project is active
- Check if API keys are valid
- Test direct Supabase connection

### 3. Network/Firewall
- Check if localhost:8080 is accessible
- Verify no firewall blocking connections
- Check browser console for specific errors

### 4. Other CSP Issues
- Meta tag CSP might conflict with header CSP
- Browser might be caching old CSP
- Multiple CSP headers might conflict

### 5. Vite Configuration
- Check if Vite server is binding correctly
- Verify host "::" works on macOS
- Check for port conflicts

---

## Debugging Steps

### Check Browser Console:
```javascript
// Look for specific errors:
- CSP violation messages
- Network errors
- WebSocket connection errors
- Supabase initialization errors
```

### Check Environment:
```bash
# Verify env vars are loaded
echo $VITE_SUPABASE_URL
cat .env | grep VITE_SUPABASE
```

### Test Direct Connection:
```bash
# Test if Supabase is reachable
curl https://vltveasdxtfvvqbzxzuf.supabase.co/rest/v1/
```

### Check Vite Server:
```bash
# Verify server is running
lsof -i :8080
curl http://localhost:8080
```

---

## Alternative Approaches

### Option 1: Remove CSP Temporarily
- Remove CSP meta tag from `index.html`
- Remove CSP from `vite.config.ts` headers
- Test if site connects without CSP
- If yes, CSP is the issue
- If no, issue is elsewhere

### Option 2: Minimal CSP
- Start with very permissive CSP
- Gradually tighten restrictions
- Test at each step

### Option 3: Check Other Headers
- `X-Frame-Options: DENY` might block iframes
- `Permissions-Policy` might block features
- Remove all security headers temporarily

---

## Next Steps After Revert

1. **Test without CSP:**
   - Remove all CSP configurations
   - See if site connects
   - This will confirm if CSP is the issue

2. **Check browser console:**
   - Get exact error messages
   - Look for specific blocked resources
   - Check network tab for failed requests

3. **Test Supabase directly:**
   - Verify Supabase credentials
   - Test API connection
   - Check Edge Functions status

4. **Simplify CSP:**
   - Start with `default-src *` (very permissive)
   - Gradually add restrictions
   - Test at each step

---

## Notes

- CSP might not be the root cause
- Could be environment variable issues
- Could be Supabase configuration
- Could be network/firewall blocking
- Need browser console errors to diagnose

---

**Status:** Reverting to previous working state  
**Next:** Test without CSP to isolate the issue

