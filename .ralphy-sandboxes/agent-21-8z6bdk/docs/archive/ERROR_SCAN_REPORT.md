# Site Error Scan Report
**Generated:** $(date)  
**Scan Type:** Comprehensive (Linting, TypeScript, Build, Security)

## Executive Summary

- ✅ **TypeScript Compilation:** No type errors found
- ❌ **ESLint Errors:** 675 errors found
- ⚠️ **ESLint Warnings:** 66 warnings found
- ❌ **Build Errors:** 1 critical build error
- ⚠️ **Security Vulnerabilities:** 4 vulnerabilities (2 high, 2 moderate)
- 📊 **Console Statements:** Found in 153 files (mostly intentional for dev tools)

---

## 1. Build Errors (CRITICAL - Must Fix)

### 1.1 PWA Service Worker File Size Limit
**Status:** ❌ Build Fails  
**Error:** `chunk-DrZB5OLe.js` exceeds Workbox's 2MB file size limit (actual: 2.25 MB)

**Impact:** 
- Production build fails completely
- PWA service worker cannot be generated
- App cannot be deployed

**Solution:**
Update `vite.config.ts` to increase the Workbox file size limit:

```typescript
VitePWA({
  workbox: {
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB instead of default 2MB
    // ... rest of config
  }
})
```

**Alternative Solution:** 
Consider code-splitting to reduce chunk size using dynamic imports.

---

## 2. ESLint Errors (675 errors)

### 2.1 TypeScript `any` Type Usage (Majority of errors)
**Count:** ~650+ errors  
**Rule:** `@typescript-eslint/no-explicit-any`

**Files Affected:**
- `src/components/AuthModal.tsx`
- `src/components/CartDrawer.tsx`
- `src/components/CheckoutUpsells.tsx`
- `src/components/CopyButton.tsx`
- `src/components/CustomerLocationSharing.tsx`
- `src/components/admin/*` (multiple admin components)
- And many more...

**Recommendation:** 
Replace `any` types with proper TypeScript interfaces/types. This improves type safety and code maintainability.

### 2.2 React Hook Dependency Warnings
**Count:** ~15 warnings  
**Rule:** `react-hooks/exhaustive-deps`

**Affected Files:**
- `src/components/CartBadgeAnimation.tsx` - Missing `prevCount` dependency
- `src/components/LiveChatWidget.tsx` - Missing `toast` dependency
- `src/components/admin/AdminNotificationCenter.tsx` - Missing `setupRealtimeNotifications`
- `src/components/admin/CourierDispatchPanel.tsx` - Missing `fetchAvailableCouriers`
- And others...

**Impact:** Potential bugs from stale closures or missing dependency updates.

### 2.3 Other ESLint Issues
- **@typescript-eslint/ban-ts-comment:** 1 error in `TerritoryMapView.tsx` (using `@ts-ignore` instead of `@ts-expect-error`)
- **react-refresh/only-export-components:** 1 warning in `ConfettiCelebration.tsx`

---

## 3. Security Vulnerabilities (4 found)

### 3.1 High Severity (2)

#### 3.1.1 lodash.template Command Injection
**Package:** `lodash.template` (via `@mapbox/mapbox-gl-directions`)  
**CVSS:** 7.2 (High)  
**Status:** No fix available (upstream dependency issue)  
**CWE:** CWE-77, CWE-94 (Command Injection)

**Impact:** Potential remote code execution if user-controlled input reaches template rendering.

**Recommendation:** 
- Consider replacing `@mapbox/mapbox-gl-directions` with an alternative
- Or ensure all input to template functions is sanitized
- Review usage of mapbox directions feature

#### 3.1.2 @mapbox/mapbox-gl-directions
**Package:** Direct dependency  
**Status:** No fix available (depends on vulnerable lodash.template)

### 3.2 Moderate Severity (2)

#### 3.2.1 esbuild Development Server Vulnerability
**Package:** `esbuild` (via `vite`)  
**CVSS:** 5.3 (Moderate)  
**CWE:** CWE-346 (Origin Validation Error)  
**Fix Available:** Yes

**Impact:** Development server may allow cross-origin requests.

**Solution:**
```bash
npm update esbuild --save-dev
```

#### 3.2.2 Vite Multiple Vulnerabilities
**Package:** `vite`  
**CVSS:** Varies (Moderate/Low)  
**Issues:**
- Server file serving bypass
- `server.fs` settings not applied to HTML
- Windows path traversal via backslash

**Solution:**
```bash
npm update vite --save-dev
```

---

## 4. Dependency Conflicts

### 4.1 React Version Mismatch
**Issue:** `react-leaflet@5.0.0` requires React 19, but project uses React 18.3.1

**Current Resolution:** Using `--legacy-peer-deps` flag (workaround)

**Recommendation:**
- Option 1: Upgrade React to v19 (breaking changes may occur)
- Option 2: Downgrade `react-leaflet` to v4.x (compatible with React 18)
- Option 3: Keep workaround but document the decision

---

## 5. Code Quality Issues

### 5.1 Large Bundle Sizes
**Warning:** Some chunks exceed 600KB after minification:
- `chunk-BXIKdix6.js`: 1.61 MB (gzipped: 434 KB)
- `chunk-DrZB5OLe.js`: 2.25 MB (gzipped: 648 KB) ⚠️ Exceeds Workbox limit

**Recommendation:**
- Implement more aggressive code-splitting
- Use dynamic imports for large features
- Consider lazy loading for admin/less-used components

### 5.2 Console Statements
**Found:** 153 files contain `console.log`, `console.error`, etc.

**Status:** Mostly intentional for:
- DevTools component (`src/components/dev/DevTools.tsx`)
- Console monitoring (`src/pages/admin/ConsoleMonitor.tsx`)
- Error reporting utilities
- Production logging utility

**Note:** Production build removes `console.log` via terser config, but keeps `console.error` and `console.warn` (intentional).

---

## 6. Recommendations Priority

### 🔴 Critical (Fix Immediately)
1. **Fix PWA Build Error:** Add `maximumFileSizeToCacheInBytes` to vite.config.ts
2. **Update Dependencies:** Run `npm update vite esbuild --save-dev` for security fixes

### 🟡 High Priority (Fix Soon)
3. **Replace `any` Types:** Create proper TypeScript interfaces (improves maintainability)
4. **Fix React Hook Dependencies:** Address exhaustive-deps warnings (prevents bugs)
5. **Address React Version Conflict:** Decide on React 19 upgrade or react-leaflet downgrade

### 🟢 Medium Priority (Improve Code Quality)
6. **Optimize Bundle Size:** Implement better code-splitting for large chunks
7. **Replace `@ts-ignore`:** Use `@ts-expect-error` with comments explaining why
8. **Security Review:** Audit usage of mapbox directions to ensure input sanitization

---

## 7. Quick Fixes

### Fix 1: PWA Build Error
**File:** `vite.config.ts`  
**Line:** ~83 (workbox config)

Add this line to the workbox config:
```typescript
maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
```

### Fix 2: Update Vulnerable Dependencies
```bash
npm update vite esbuild --save-dev
npm audit fix
```

### Fix 3: Fix @ts-ignore
**File:** `src/components/admin/TerritoryMapView.tsx`  
**Line:** ~57

Replace:
```typescript
// @ts-ignore
```

With:
```typescript
// @ts-expect-error - Mapbox types issue: [explain reason]
```

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| TypeScript Errors | 0 | ✅ Pass |
| ESLint Errors | 675 | ❌ Fail |
| ESLint Warnings | 66 | ⚠️ Warn |
| Build Errors | 1 | ❌ Fail |
| Security Vulnerabilities | 4 | ⚠️ Warn |
| Dependency Conflicts | 1 | ⚠️ Warn |

**Overall Status:** ⚠️ **Requires Attention**

The codebase builds successfully except for the PWA configuration issue. TypeScript compilation passes, but there are significant code quality issues (primarily `any` types) and security vulnerabilities that should be addressed.

