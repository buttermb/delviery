# Zen Firewall (AikidoSec) Setup Guide

**Date:** 2025-01-28  
**Status:** ✅ Installed

---

## 📦 Installation Complete

The Zen Firewall package has been installed:
```bash
npm install @aikidosec/firewall --legacy-peer-deps
```

---

## ⚠️ Important Note

**Zen Firewall is designed for Node.js/Express backend servers**, not React frontend applications.

This React/Vite application is a **frontend client**. For full protection, you need to:

1. **Set up Zen on your backend server** (if you have one)
2. **Or use Zen on your deployment platform** (Vercel, Netlify, etc.)

---

## 🔧 Current Setup

### 1. Environment Variable

The token has been added to `.env`:
```
AIKIDO_TOKEN=AIK_RUNTIME_47083_33691_EU_KrqJRDttFaBxkqLrrBUGDX6ymBMotvI4NF6URVLOxuhHovJN
```

**⚠️ Security Note:** `.env` is in `.gitignore` - do NOT commit this file to git!

### 2. Frontend Initialization

Added initialization attempt in `src/main.tsx` (at the very top, before other imports).

**Note:** This may not work in browser environment as Zen is designed for Node.js.

---

## 🚀 Backend Setup (Recommended)

If you have a backend server (Express.js, Next.js API routes, etc.), set it up there:

### Express.js Example:
```javascript
// app.js or server.js
// Include this BEFORE any other code or imports
require('@aikidosec/firewall');

const express = require('express');
const app = express();

// Rest of your Express app...
```

### Environment Variable:
Make sure `AIKIDO_TOKEN` is set in your backend environment:
```bash
export AIKIDO_TOKEN=AIK_RUNTIME_47083_33691_EU_KrqJRDttFaBxkqLrrBUGDX6ymBMotvI4NF6URVLOxuhHovJN
```

---

## 🔍 Deployment Platforms

### Vercel
Add environment variable in Vercel dashboard:
- Settings → Environment Variables
- Name: `AIKIDO_TOKEN`
- Value: `AIK_RUNTIME_47083_33691_EU_KrqJRDttFaBxkqLrrBUGDX6ymBMotvI4NF6URVLOxuhHovJN`

### Netlify
Add environment variable in Netlify dashboard:
- Site settings → Environment variables
- Key: `AIKIDO_TOKEN`
- Value: `AIK_RUNTIME_47083_33691_EU_KrqJRDttFaBxkqLrrBUGDX6ymBMotvI4NF6URVLOxuhHovJN`

### Other Platforms
Add `AIKIDO_TOKEN` to your platform's environment variables.

---

## ✅ Testing

1. **Test locally** (if you have a backend):
   ```bash
   # Set environment variable
   export AIKIDO_TOKEN=AIK_RUNTIME_47083_33691_EU_KrqJRDttFaBxkqLrrBUGDX6ymBMotvI4NF6URVLOxuhHovJN
   
   # Run your backend server
   npm start
   ```

2. **Test on staging** before deploying to production

3. **Verify in AikidoSec dashboard** that your application is being monitored

---

## 🔐 Security Best Practices

1. ✅ **Never commit `.env` file** - Already in `.gitignore`
2. ✅ **Regenerate token if exposed** - Go to AikidoSec dashboard
3. ✅ **Use different tokens for dev/staging/prod**
4. ✅ **Set up on backend server** for full protection

---

## 📚 Resources

- [AikidoSec Documentation](https://docs.aikido.dev)
- [Zen Firewall GitHub](https://github.com/aikidosec/firewall)

---

## 🎯 Next Steps

1. **If you have a backend server:**
   - Set up Zen on your Express.js/Node.js backend
   - Add `AIKIDO_TOKEN` to backend environment variables
   - Test locally and on staging

2. **If you're using a deployment platform:**
   - Add `AIKIDO_TOKEN` to platform environment variables
   - Deploy and verify in AikidoSec dashboard

3. **If you only have a frontend:**
   - Consider setting up a simple backend API
   - Or use Zen on your deployment platform's edge functions

---

**Status:** Package installed, environment variable configured. Backend setup required for full protection.

