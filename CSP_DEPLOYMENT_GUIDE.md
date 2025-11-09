# Content Security Policy (CSP) Deployment Guide

**Date:** 2025-01-28  
**Status:** ✅ Configured

---

## 🎯 Overview

Content Security Policy (CSP) is now configured across all deployment methods to protect against XSS attacks, data injection, and other security vulnerabilities.

---

## ✅ Implementation Status

### 1. HTML Meta Tag ✅
**File:** `index.html`
- CSP meta tag added in `<head>` section
- Works on all platforms as fallback
- Policy includes all required domains

### 2. Vite Dev Server ✅
**File:** `vite.config.ts`
- CSP header configured for development server
- Additional security headers included
- Active when running `npm run dev`

### 3. Netlify Headers ✅
**File:** `public/_headers`
- CSP header configured for Netlify deployments
- Enhanced with `object-src 'none'` and `upgrade-insecure-requests`
- Automatically applied on Netlify

### 4. Vercel Configuration ✅
**File:** `vercel.json`
- CSP and security headers configured
- Automatically applied on Vercel deployments

---

## 🔒 CSP Policy Details

The Content Security Policy allows:

### Scripts
- `'self'` - Same origin scripts
- `'unsafe-inline'` - Required for theme initialization script
- `'unsafe-eval'` - Required for Vite dev server (development)
- `https://vltveasdxtfvvqbzxzuf.supabase.co` - Supabase API
- `https://api.mapbox.com` - Mapbox API
- `https://events.mapbox.com` - Mapbox events
- `https://*.mapbox.com` - All Mapbox subdomains
- `https://fonts.googleapis.com` - Google Fonts loader

### Styles
- `'self'` - Same origin styles
- `'unsafe-inline'` - Required for critical inline CSS
- `https://fonts.googleapis.com` - Google Fonts CSS
- `https://api.mapbox.com` - Mapbox styles
- `https://*.mapbox.com` - Mapbox subdomain styles

### Images
- `'self'` - Same origin images
- `data:` - Data URIs (for inline images)
- `https:` - All HTTPS images
- `blob:` - Blob URLs (for generated images)

### Fonts
- `'self'` - Same origin fonts
- `https://fonts.gstatic.com` - Google Fonts
- `data:` - Data URI fonts
- `https://api.mapbox.com` - Mapbox fonts
- `https://*.mapbox.com` - Mapbox subdomain fonts

### Connections
- `'self'` - Same origin connections
- `https://vltveasdxtfvvqbzxzuf.supabase.co` - Supabase HTTPS
- `wss://vltveasdxtfvvqbzxzuf.supabase.co` - Supabase WebSocket
- `https://api.mapbox.com` - Mapbox API
- `https://events.mapbox.com` - Mapbox events
- `https://*.mapbox.com` - Mapbox subdomains

### Security Directives
- `frame-ancestors 'none'` - Prevent clickjacking
- `base-uri 'self'` - Restrict base tag
- `form-action 'self'` - Restrict form submissions
- `object-src 'none'` - Block plugins
- `upgrade-insecure-requests` - Force HTTPS

---

## 🚀 Platform-Specific Setup

### Netlify ✅
**Automatic** - `public/_headers` is automatically used by Netlify.

No additional configuration needed. The headers file is automatically applied.

**Verify:**
1. Deploy to Netlify
2. Check response headers in browser DevTools
3. Verify `Content-Security-Policy` header is present

---

### Vercel ✅
**Automatic** - `vercel.json` is automatically used by Vercel.

No additional configuration needed. The headers are automatically applied.

**Verify:**
1. Deploy to Vercel
2. Check response headers in browser DevTools
3. Verify `Content-Security-Policy` header is present

---

### Supabase Hosting
**Manual Configuration Required**

If deploying to Supabase Hosting, you need to configure headers manually:

1. **Via Supabase Dashboard:**
   - Go to Project Settings → API
   - Configure custom headers

2. **Via Edge Function:**
   - Create an edge function that adds headers
   - Or use Supabase's header configuration

**Example Edge Function:**
```typescript
// supabase/functions/add-headers/index.ts
Deno.serve(async (req) => {
  const response = await fetch(req);
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Security-Policy', 'default-src \'self\'; ...');
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
});
```

---

### Nginx Configuration
**For self-hosted deployments**

Add to your Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vltveasdxtfvvqbzxzuf.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com https://*.mapbox.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data: https://api.mapbox.com https://*.mapbox.com; connect-src 'self' https://vltveasdxtfvvqbzxzuf.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com wss://vltveasdxtfvvqbzxzuf.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;" always;
    
    # Additional security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

### Apache Configuration
**For Apache deployments**

Add to your `.htaccess` or Apache config:

```apache
<IfModule mod_headers.c>
    # Content Security Policy
    Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vltveasdxtfvvqbzxzuf.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com https://*.mapbox.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data: https://api.mapbox.com https://*.mapbox.com; connect-src 'self' https://vltveasdxtfvvqbzxzuf.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com wss://vltveasdxtfvvqbzxzuf.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;"
    
    # Additional security headers
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>
```

---

### Cloudflare Pages
**Via Cloudflare Dashboard:**

1. Go to Pages → Your Site → Settings → Functions
2. Add `_headers` file in `public/` directory (already done)
3. Or configure via Cloudflare Workers

**Via Cloudflare Workers:**
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Content-Security-Policy', 'default-src \'self\'; ...');
  return newResponse;
}
```

---

## 🧪 Testing CSP

### 1. Verify Header is Set

**Browser DevTools:**
1. Open your deployed site
2. Open DevTools → Network tab
3. Reload page
4. Click on the main document request
5. Check Response Headers
6. Verify `Content-Security-Policy` header is present

**Command Line:**
```bash
curl -I https://your-domain.com | grep -i content-security-policy
```

### 2. Test CSP Violations

**Browser Console:**
1. Open browser DevTools → Console
2. Look for CSP violation warnings
3. Common violations:
   - `Refused to load script from...` - Script source not allowed
   - `Refused to load stylesheet from...` - Style source not allowed
   - `Refused to connect to...` - Connection source not allowed

### 3. Test Functionality

Verify all features work:
- ✅ Maps load (Mapbox)
- ✅ Fonts load (Google Fonts)
- ✅ Supabase connections work
- ✅ Images load
- ✅ Forms submit
- ✅ Theme switching works

---

## 🔧 Troubleshooting

### Issue: CSP Violations in Console

**Symptom:** Browser console shows CSP violation errors

**Solution:**
1. Check which resource is being blocked
2. Add the domain to the appropriate CSP directive
3. Update all CSP configurations (meta tag, vite.config.ts, _headers, vercel.json)

### Issue: Maps Not Loading

**Symptom:** Mapbox maps don't appear

**Solution:**
- Verify `https://api.mapbox.com` and `https://*.mapbox.com` are in:
  - `script-src`
  - `style-src`
  - `connect-src`
  - `img-src` (for map tiles)

### Issue: Fonts Not Loading

**Symptom:** Google Fonts don't load

**Solution:**
- Verify `https://fonts.googleapis.com` is in `style-src`
- Verify `https://fonts.gstatic.com` is in `font-src`

### Issue: Supabase Not Connecting

**Symptom:** Supabase API calls fail

**Solution:**
- Verify `https://vltveasdxtfvvqbzxzuf.supabase.co` is in `connect-src`
- Verify `wss://vltveasdxtfvvqbzxzuf.supabase.co` is in `connect-src` (for WebSocket)

### Issue: Theme Not Applying

**Symptom:** Theme initialization script doesn't run

**Solution:**
- Verify `'unsafe-inline'` is in `script-src`
- This is required for the inline theme script in `index.html`

---

## 📊 CSP Report-Only Mode (Optional)

For testing, you can use CSP Report-Only mode:

**Meta Tag:**
```html
<meta http-equiv="Content-Security-Policy-Report-Only" content="..." />
```

**Header:**
```
Content-Security-Policy-Report-Only: ...
```

This will log violations without blocking resources, useful for testing.

---

## 🔐 Security Best Practices

1. **Start Strict, Loosen as Needed**
   - Begin with strict CSP
   - Add domains only when necessary
   - Document why each domain is needed

2. **Use Nonces for Inline Scripts** (Future Enhancement)
   - Generate nonces for inline scripts
   - More secure than `'unsafe-inline'`
   - Requires server-side rendering or build-time generation

3. **Regular Audits**
   - Review CSP violations regularly
   - Remove unused domains
   - Tighten policies over time

4. **Monitor Violations**
   - Set up CSP violation reporting
   - Use services like Sentry or custom reporting endpoint

---

## ✅ Verification Checklist

- [ ] CSP meta tag present in `index.html`
- [ ] CSP header configured in `vite.config.ts`
- [ ] CSP header in `public/_headers` (Netlify)
- [ ] CSP header in `vercel.json` (Vercel)
- [ ] All required domains included
- [ ] Browser DevTools shows CSP header
- [ ] No CSP violations in console
- [ ] Maps load correctly
- [ ] Fonts load correctly
- [ ] Supabase connections work
- [ ] Forms submit correctly
- [ ] Theme switching works

---

## 📚 Resources

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Test your CSP
- [Report URI](https://report-uri.com/) - CSP violation reporting

---

**Status: Production Ready** ✅

CSP is now configured across all deployment methods. The security scan should no longer report missing CSP headers.

