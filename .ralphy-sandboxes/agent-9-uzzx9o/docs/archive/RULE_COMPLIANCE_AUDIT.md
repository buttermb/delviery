# Rule Compliance Audit

**Date:** 2025-01-28  
**Status:** In Progress

---

## ✅ Completed Fixes

### 1. Console Statements → Logger
**Fixed Files:**
- ✅ `src/components/menu/OrderFormDialog.tsx` - Replaced all `console.error` with `logger.error`
- ✅ `src/components/menu/ModernCheckoutFlow.tsx` - Replaced all `console.error` with `logger.error`
- ✅ `src/pages/admin/AdminUserDetails.tsx` - Replaced all `console.error` with `logger.error` (9 instances)
- ✅ `src/components/ui/monitored-button.tsx` - Removed `console.error`, using `logger.error` only

**Pattern Applied:**
```typescript
// Before
console.error('Error message:', error);

// After
logger.error('Error message', error instanceof Error ? error : new Error(String(error)), { component: 'ComponentName', context });
```

### 2. localStorage → STORAGE_KEYS
**Fixed Files:**
- ✅ `src/components/menu/ModernCheckoutFlow.tsx` - Replaced direct `localStorage` calls with `safeStorage` and `STORAGE_KEYS`

**Changes:**
- Added `GUEST_CHECKOUT_DATA` to `STORAGE_KEYS`
- Updated to use `safeStorage.getItem()`, `safeStorage.setItem()`
- Updated to use `safeJsonParse()` and `safeJsonStringify()`

### 3. Error Types: `any` → `unknown`
**Fixed Files:**
- ✅ All error catch blocks in fixed files now use `error: unknown` instead of `error: any`
- ✅ Proper type guards: `error instanceof Error ? error : new Error(String(error))`

---

## 📋 Remaining Work

### High Priority (User-Facing Components)

#### 1. Console Statements (~144 files remaining)
**Priority Files:**
- `src/components/admin/*` - Admin components
- `src/pages/admin/*` - Admin pages
- `src/pages/customer/*` - Customer pages
- `src/pages/courier/*` - Courier pages
- `src/components/menu/*` - Menu components

**Action Required:**
- Replace `console.log` → `logger.debug` (dev only)
- Replace `console.error` → `logger.error`
- Replace `console.warn` → `logger.warn`
- Replace `console.info` → `logger.info`

#### 2. localStorage Direct Usage (~54 files remaining)
**Priority Files:**
- `src/pages/customer/*` - Customer pages
- `src/components/customer/*` - Customer components
- `src/hooks/useLocalStorage*.ts` - Storage hooks (verify they use STORAGE_KEYS)

**Action Required:**
- Replace `localStorage.getItem()` → `safeStorage.getItem(STORAGE_KEYS.KEY_NAME)`
- Replace `localStorage.setItem()` → `safeStorage.setItem(STORAGE_KEYS.KEY_NAME, value)`
- Replace `localStorage.removeItem()` → `safeStorage.removeItem(STORAGE_KEYS.KEY_NAME)`
- Add missing keys to `STORAGE_KEYS` if needed
- Wrap in try-catch (already handled by `safeStorage`)

#### 3. window.location Usage (~29 files remaining)
**Priority Files:**
- `src/pages/saas/SignUpPage.tsx`
- `src/pages/customer/SecureMenuAccess.tsx`
- `src/pages/admin/ClientDetail.tsx`
- `src/pages/saas/SuperAdminEnhanced.tsx`
- `src/components/admin/LiveDeliveryMap.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/auth/TenantAdminProtectedRoute.tsx`

**Action Required:**
- Replace `window.location.href = ...` → `navigate(...)` or `<Link to={...} />`
- Replace `window.location.assign(...)` → `navigate(...)`
- Replace `window.location.replace(...)` → `navigate(..., { replace: true })`
- Import `useNavigate` from `react-router-dom` where needed

#### 4. `any` Types (~308 files remaining)
**Priority:**
- Focus on components and hooks first
- Critical types: error handlers, API responses, form data

**Action Required:**
- Replace `any` with proper types or `unknown`
- Use type guards for `unknown` types
- Define interfaces for complex objects

---

## 🔍 Audit Commands

### Find Console Statements
```bash
grep -r "console\.\(log\|error\|warn\|info\|debug\)" src/components src/pages --include="*.tsx" --include="*.ts" | wc -l
```

### Find localStorage Usage
```bash
grep -r "localStorage\.\(getItem\|setItem\|removeItem\)" src/components src/pages --include="*.tsx" --include="*.ts" | wc -l
```

### Find window.location Usage
```bash
grep -r "window\.location\.\(href\|assign\|replace\)" src/components src/pages --include="*.tsx" --include="*.ts" | wc -l
```

### Find `any` Types
```bash
grep -r ":\s*any\b" src/components src/pages --include="*.tsx" --include="*.ts" | wc -l
```

---

## 📝 Implementation Guidelines

### Console → Logger Pattern
```typescript
// ❌ Don't
console.error('Error:', error);
console.log('Debug info:', data);

// ✅ Do
import { logger } from '@/lib/logger';

logger.error('Error message', error instanceof Error ? error : new Error(String(error)), { component: 'ComponentName', context });
logger.debug('Debug info', { data, component: 'ComponentName' });
```

### localStorage → STORAGE_KEYS Pattern
```typescript
// ❌ Don't
const data = localStorage.getItem('myKey');
localStorage.setItem('myKey', JSON.stringify(value));

// ✅ Do
import { STORAGE_KEYS, safeStorage, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';

const data = safeStorage.getItem(STORAGE_KEYS.MY_KEY);
const parsed = safeJsonParse(data, defaultValue);

const json = safeJsonStringify(value);
if (json) {
  safeStorage.setItem(STORAGE_KEYS.MY_KEY, json);
}
```

### window.location → Navigation Pattern
```typescript
// ❌ Don't
window.location.href = '/admin/products';
window.location.assign('/admin/products');

// ✅ Do
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/admin/products');

// Or in JSX
import { Link } from 'react-router-dom';
<Link to="/admin/products">Go to Products</Link>
```

### Error Type Pattern
```typescript
// ❌ Don't
catch (error: any) {
  console.error('Error:', error);
}

// ✅ Do
catch (error: unknown) {
  logger.error('Error message', error instanceof Error ? error : new Error(String(error)), { component: 'ComponentName' });
  const message = error instanceof Error ? error.message : 'Unknown error';
  toast.error(message);
}
```

---

## 🎯 Next Steps

1. **Continue with high-priority files:**
   - Fix console statements in user-facing components
   - Fix window.location in navigation-critical files
   - Fix localStorage in customer/admin components

2. **Run linter:**
   ```bash
   npm run lint
   ```

3. **Run type check:**
   ```bash
   npx tsc --noEmit
   ```

4. **Test critical flows:**
   - Customer checkout
   - Admin product creation
   - Navigation flows

---

## 📊 Progress Tracking

- **Console Statements:** 4/148 fixed (2.7%)
- **localStorage:** 1/55 fixed (1.8%)
- **window.location:** 0/29 fixed (0%)
- **any types:** Partial fixes in error handlers

**Estimated Remaining Work:** ~500+ individual fixes across ~400 files

---

## ✅ Rules Verified

- ✅ Logger usage in fixed files
- ✅ STORAGE_KEYS usage in fixed files
- ✅ Error type safety in fixed files
- ✅ Button monitoring system (already implemented)
- ⏳ Navigation patterns (in progress)
- ⏳ Type safety (in progress)

