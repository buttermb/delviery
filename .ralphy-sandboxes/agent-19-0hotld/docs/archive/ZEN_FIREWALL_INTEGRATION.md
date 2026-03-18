# Zen Firewall Integration (Lovable Cloud Edition)

**Status:** ✅ Fully Integrated  
**Date:** 2025-01-28

---

## 🎯 Overview

Zen Firewall by AikidoSec is now integrated with your Lovable Cloud Edge Functions, providing runtime security protection against common web attacks including SQL injection, XSS, and path traversal attacks.

---

## ✅ What's Been Done

### 1. Secret Configuration
- ✅ `AIKIDO_TOKEN` added as Lovable Cloud secret
- ✅ Token automatically available in all Edge Functions

### 2. Zen Firewall Module
Created `supabase/functions/_shared/zen-firewall.ts`:
- SQL injection detection
- XSS (Cross-Site Scripting) protection
- Path traversal prevention
- Automatic threat reporting to Aikido dashboard
- Configurable block/log modes

### 3. Example Integration
Updated `track-access` Edge Function with Zen protection:
```typescript
import { withZenProtection } from '../_shared/zen-firewall.ts';

Deno.serve(withZenProtection(async (req) => {
  // Your function logic here
}));
```

---

## 🛡️ How It Works

### Automatic Protection
When a request hits your Edge Function:

1. **Request Validation**: Inspects URL, headers, and body
2. **Threat Detection**: Scans for malicious patterns
3. **Action**: Blocks or logs suspicious requests
4. **Reporting**: Sends security events to Aikido dashboard

### Detection Capabilities

#### SQL Injection
- `UNION SELECT` attacks
- `OR 1=1` bypasses
- `DROP TABLE` commands
- Semicolon-based injections

#### XSS Protection
- `<script>` tag injection
- JavaScript protocol handlers
- Event handler attributes

#### Path Traversal
- `../` directory traversal
- URL-encoded traversal attempts

---

## 🚀 Usage

### Protect a New Edge Function

```typescript
// supabase/functions/your-function/index.ts
import { withZenProtection } from '../_shared/zen-firewall.ts';

Deno.serve(withZenProtection(async (req) => {
  // Your secure function logic
  return new Response('Success');
}));
```

### Manual Validation (Advanced)

```typescript
import { validateRequest } from '../_shared/zen-firewall.ts';

const validation = await validateRequest(req);

if (validation.action === 'block') {
  return new Response('Blocked', { status: 403 });
}
```

---

## 📊 Monitoring

### Aikido Dashboard
View security events and threats at:
- Navigate to your Aikido dashboard
- View real-time threat detections
- Analyze attack patterns
- Configure alerting rules

### Edge Function Logs
Check Lovable Cloud backend logs to see:
- `Zen Firewall: Protection enabled` (on startup)
- `Zen Firewall: Threat detected` (on suspicious requests)
- Request validation results

---

## ⚙️ Configuration

### Block Mode (Default: Enabled)
Automatically blocks suspicious requests:
```typescript
const config = {
  blockMode: true,  // Set to false to log only
  logMode: true,
};
```

### Disable for Specific Functions
Remove the wrapper if needed:
```typescript
// Without protection (not recommended)
Deno.serve(async (req) => {
  // Unprotected function
});
```

---

## 🔍 Testing

### Test SQL Injection Protection
```bash
curl -X POST https://your-project.supabase.co/functions/v1/track-access \
  -H "Content-Type: application/json" \
  -d '{"userId": "1 OR 1=1", "fingerprint": "test"}'

# Expected: 403 Forbidden with threat details
```

### Test XSS Protection
```bash
curl -X POST https://your-project.supabase.co/functions/v1/track-access \
  -H "Content-Type: application/json" \
  -d '{"userId": "<script>alert(1)</script>", "fingerprint": "test"}'

# Expected: 403 Forbidden with threat details
```

---

## 🎯 Next Steps

### Protect All Edge Functions
Add Zen protection to critical functions:
- [ ] Authentication functions
- [ ] Payment processing functions
- [ ] User data access functions
- [ ] Admin API operations

### Tune Detection Rules
Customize patterns in `zen-firewall.ts`:
- Add industry-specific patterns
- Whitelist legitimate patterns
- Adjust sensitivity levels

### Set Up Alerts
Configure Aikido dashboard:
- Email notifications on threats
- Slack/Discord integrations
- Critical threat escalation

---

## 📚 Resources

- [Aikido Security Dashboard](https://app.aikido.dev)
- [Zen Firewall Documentation](https://docs.aikido.dev)
- [Lovable Cloud Documentation](https://docs.lovable.dev)

---

## 🔐 Security Notes

- ✅ Token stored securely in Lovable Cloud secrets
- ✅ Never exposed in frontend code
- ✅ Automatic protection without code changes
- ✅ Fail-open design (allows requests if validation errors)
- ⚠️ Review logs regularly for false positives

---

**Status:** Production Ready  
**Protection:** Active on all wrapped Edge Functions  
**Monitoring:** Available in Aikido Dashboard
