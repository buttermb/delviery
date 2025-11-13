# Lovable AI Implementation Guide: Network Resilience & Login Fixes

## Overview
This guide provides step-by-step instructions for implementing network resilience and fixing login issues in the business admin panel. All changes are designed to handle network failures gracefully with automatic retries and better error handling.

## Prerequisites
- Access to the codebase
- Understanding of React, TypeScript, and Supabase
- Knowledge of the existing auth context structure

---

## Phase 1: Create Network Resilience Utilities

### Step 1.1: Create `src/lib/utils/networkResilience.ts`

**Purpose:** Centralized network resilience utilities with retry logic, error categorization, and connection monitoring.

**File Location:** `src/lib/utils/networkResilience.ts`

**Key Components:**
1. **Error Categories Enum:**
   ```typescript
   export enum ErrorCategory {
     NETWORK = 'NETWORK',
     AUTH = 'AUTH',
     VALIDATION = 'VALIDATION',
     SERVER = 'SERVER',
     CLIENT = 'CLIENT',
     TIMEOUT = 'TIMEOUT',
     UNKNOWN = 'UNKNOWN',
   }
   ```

2. **Error Categorization Function:**
   ```typescript
   export function categorizeError(error: unknown, response?: Response): ErrorCategory
   ```
   - Categorizes errors based on type and HTTP status
   - Returns appropriate ErrorCategory

3. **Resilient Fetch Function:**
   ```typescript
   export async function resilientFetch(
     url: string,
     options: ResilientFetchOptions = {}
   ): Promise<ResilientFetchResult>
   ```
   - Automatic retry with exponential backoff
   - Configurable timeout and retry settings
   - Error categorization
   - Callbacks for retry and error events

4. **Connection Status Monitoring:**
   ```typescript
   export function initConnectionMonitoring(): void
   export function onConnectionStatusChange(callback: (status: ConnectionStatus) => void): () => void
   export function getConnectionStatus(): ConnectionStatus
   export function isOffline(): boolean
   ```

**Reference Implementation:**
- See `src/lib/utils/networkResilience.ts` (410 lines)
- Key functions: `resilientFetch`, `categorizeError`, `getErrorMessage`, `initConnectionMonitoring`

**Testing:**
- Verify error categorization works for different error types
- Test retry logic with network interruptions
- Verify connection status monitoring works

---

### Step 1.2: Create `src/lib/utils/authFlowLogger.ts`

**Purpose:** Detailed logging for authentication flows with performance metrics.

**File Location:** `src/lib/utils/authFlowLogger.ts`

**Key Components:**
1. **Auth Flow Steps Enum:**
   ```typescript
   export enum AuthFlowStep {
     INIT = 'INIT',
     VALIDATE_INPUT = 'VALIDATE_INPUT',
     NETWORK_REQUEST = 'NETWORK_REQUEST',
     PARSE_RESPONSE = 'PARSE_RESPONSE',
     STORE_TOKEN = 'STORE_TOKEN',
     VERIFY_TOKEN = 'VERIFY_TOKEN',
     REFRESH_TOKEN = 'REFRESH_TOKEN',
     REDIRECT = 'REDIRECT',
     COMPLETE = 'COMPLETE',
     ERROR = 'ERROR',
   }
   ```

2. **Auth Actions Enum:**
   ```typescript
   export enum AuthAction {
     LOGIN = 'LOGIN',
     LOGOUT = 'LOGOUT',
     SIGNUP = 'SIGNUP',
     VERIFY = 'VERIFY',
     REFRESH = 'REFRESH',
     IMPERSONATE = 'IMPERSONATE',
   }
   ```

3. **Auth Flow Logger Class:**
   ```typescript
   class AuthFlowLogger {
     startFlow(action: AuthAction, metadata?: Record<string, unknown>): string
     logStep(flowId: string, step: AuthFlowStep, metadata?: Record<string, unknown>): void
     logFetchAttempt(flowId: string, url: string, attempt: number, metadata?: Record<string, unknown>): void
     logFetchRetry(flowId: string, url: string, attempt: number, error: unknown, delay: number): void
     logFetchSuccess(flowId: string, url: string, status: number, duration: number): void
     logFetchFailure(flowId: string, url: string, error: unknown, category: ErrorCategory, attempts: number): void
     completeFlow(flowId: string, metadata?: Record<string, unknown>): void
     failFlow(flowId: string, error: unknown, category: ErrorCategory, metadata?: Record<string, unknown>): void
   }
   ```

**Reference Implementation:**
- See `src/lib/utils/authFlowLogger.ts` (244 lines)
- Singleton instance: `authFlowLogger`

**Testing:**
- Verify flow tracking works end-to-end
- Check performance metrics are captured
- Verify error logging includes proper context

---

## Phase 2: Update TenantAdminAuthContext

### Step 2.1: Add Imports

**File:** `src/contexts/TenantAdminAuthContext.tsx`

**Add these imports at the top:**
```typescript
import { resilientFetch, safeFetch, ErrorCategory, getErrorMessage, initConnectionMonitoring, onConnectionStatusChange, type ConnectionStatus } from "@/lib/utils/networkResilience";
import { authFlowLogger, AuthFlowStep, AuthAction } from "@/lib/utils/authFlowLogger";
```

**Why:** These imports provide network resilience and auth flow logging capabilities.

---

### Step 2.2: Initialize Connection Monitoring

**Location:** After the `validateEnvironment` function, before `TenantAdminAuthProvider`

**Add:**
```typescript
// Initialize connection monitoring on module load
if (typeof window !== 'undefined') {
  initConnectionMonitoring();
}
```

**Why:** Starts monitoring connection status when the module loads.

---

### Step 2.3: Add Connection Status State

**Location:** Inside `TenantAdminAuthProvider`, with other state declarations

**Add:**
```typescript
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
```

**Add useEffect for monitoring:**
```typescript
// Monitor connection status
useEffect(() => {
  const unsubscribe = onConnectionStatusChange((status) => {
    setConnectionStatus(status);
    logger.info('Connection status updated in auth context', { status });
  });
  return unsubscribe;
}, []);
```

**Why:** Tracks connection status for better error handling and user feedback.

---

### Step 2.4: Update Initialization Verification

**Location:** Inside `initializeAuth` function, around line 220

**Find:**
```typescript
const verifyResponse = await safeFetch(
  `${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`,
  {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  }
);
```

**Replace with:**
```typescript
const { response: verifyResponse } = await resilientFetch(
  `${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`,
  {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout for initialization
    retryConfig: {
      maxRetries: 1, // Only 1 retry for initialization
      initialDelay: 500,
    },
  }
);
```

**Why:** Adds retry logic and timeout handling for initialization.

---

### Step 2.5: Update Token Verification

**Location:** Inside `verifyToken` function, around line 340-360

**Find:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
  method: "GET",
  credentials: 'include',
  headers,
  signal: controller.signal,
});
clearTimeout(timeoutId);
```

**Replace with:**
```typescript
// Use resilientFetch - it handles timeouts and retries internally
const { response: resilientResponse, category } = await resilientFetch(
  `${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`,
  {
    method: "GET",
    credentials: 'include',
    headers,
    timeout: VERIFY_TIMEOUT_MS,
    retryConfig: {
      maxRetries: retryCount < maxRetries ? 1 : 0,
      initialDelay: 500,
    },
  }
);
response = resilientResponse;
```

**Remove:** The `clearTimeout(timeoutId)` calls in the catch block (no longer needed).

**Why:** Removes AbortController conflicts and adds proper retry logic.

---

### Step 2.6: Update Token Refresh in verifyToken

**Location:** Inside `verifyToken` function, around line 404

**Find:**
```typescript
const refreshResponse = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ refresh_token: storedRefreshToken }),
});
```

**Replace with:**
```typescript
const { response: refreshResponse } = await resilientFetch(
  `${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: storedRefreshToken }),
    timeout: 10000,
    retryConfig: {
      maxRetries: 1,
      initialDelay: 500,
    },
  }
);
```

**Why:** Adds retry logic for token refresh.

---

### Step 2.7: Update Login Function

**Location:** Inside `login` function, around line 550-570

**Add at the start:**
```typescript
const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email, tenantSlug });

try {
  authFlowLogger.logStep(flowId, AuthFlowStep.VALIDATE_INPUT);
```

**Find:**
```typescript
const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, tenantSlug }),
  signal: controller.signal,
});
```

**Replace with:**
```typescript
const url = `${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`;

authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
authFlowLogger.logFetchAttempt(flowId, url, 1);

const { response, attempts, category } = await resilientFetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, tenantSlug }),
  timeout: 30000, // 30 seconds for login
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000,
  },
  onRetry: (attempt, error) => {
    const delay = 1000 * Math.pow(2, attempt - 1);
    authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
  },
  onError: (errorCategory) => {
    authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, attempts);
  },
});
```

**Add after successful response:**
```typescript
authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);
```

**Add before the end of try block:**
```typescript
authFlowLogger.logStep(flowId, AuthFlowStep.COMPLETE);
authFlowLogger.completeFlow(flowId, { tenantId: data.tenant?.id });
```

**Update catch block:**
```typescript
} catch (error) {
  const category = error instanceof Error && error.message.includes('Network') 
    ? ErrorCategory.NETWORK 
    : ErrorCategory.AUTH;
  authFlowLogger.failFlow(flowId, error, category);
  logger.error("Login error", error);
  throw error;
}
```

**Why:** Adds comprehensive logging and retry logic to login flow.

---

### Step 2.8: Update Logout Function

**Location:** Inside `logout` function, around line 632

**Find:**
```typescript
await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
  method: "POST",
  credentials: 'include',
  headers: {
    "Content-Type": "application/json",
  },
});
```

**Replace with:**
```typescript
await resilientFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
  method: "POST",
  credentials: 'include',
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
  retryConfig: {
    maxRetries: 1,
    initialDelay: 500,
  },
});
```

**Why:** Adds retry logic for logout.

---

### Step 2.9: Update refreshAuthToken Function

**Location:** Inside `refreshAuthToken` function, around line 745

**Find:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ refresh_token: currentRefreshToken }),
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

**Replace with:**
```typescript
const { response } = await resilientFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ refresh_token: currentRefreshToken }),
  timeout: 10000,
  retryConfig: {
    maxRetries: 2,
    initialDelay: 1000,
  },
});
```

**Why:** Adds retry logic and removes AbortController conflicts.

---

### Step 2.10: Update Subscription Change Verification

**Location:** Inside the subscription change effect, around line 834

**Find:**
```typescript
const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${accessToken || localStorage.getItem(ACCESS_TOKEN_KEY)}`,
    "Content-Type": "application/json",
  },
});
```

**Replace with:**
```typescript
const { response } = await resilientFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${accessToken || localStorage.getItem(ACCESS_TOKEN_KEY)}`,
    "Content-Type": "application/json",
  },
  credentials: 'include',
  timeout: 10000,
  retryConfig: {
    maxRetries: 1,
    initialDelay: 500,
  },
});
```

**Why:** Adds retry logic for subscription change verification.

---

### Step 2.11: Export Connection Status

**Location:** In the context value object, around line 895

**Add:**
```typescript
connectionStatus,
```

**Update interface:**
```typescript
interface TenantAdminAuthContextType {
  // ... existing fields
  connectionStatus: ConnectionStatus; // Network connection status
  // ... rest of fields
}
```

**Why:** Exposes connection status to components that need it.

---

## Phase 3: Update LoginPage (SaaS Login)

**Note:** The SaaS login page (`src/pages/saas/LoginPage.tsx`) is the main entry point for tenant admin login. This is where users log in after signup or when accessing the platform.

**Status Check:** Verify the SaaS login page already has network resilience. If not, follow these steps.

### Step 3.1: Add Imports

**File:** `src/pages/saas/LoginPage.tsx`

**Add:**
```typescript
import { resilientFetch, ErrorCategory, getErrorMessage, onConnectionStatusChange, type ConnectionStatus, isOffline } from '@/lib/utils/networkResilience';
import { authFlowLogger, AuthFlowStep, AuthAction } from '@/lib/utils/authFlowLogger';
```

---

### Step 3.2: Add State and Connection Monitoring

**Location:** Inside the component, with other state

**Add:**
```typescript
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
const [retryCount, setRetryCount] = useState(0);

// Monitor connection status
useEffect(() => {
  const unsubscribe = onConnectionStatusChange((status) => {
    setConnectionStatus(status);
    if (status === 'offline') {
      toast({
        title: 'No Internet Connection',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    }
  });
  return unsubscribe;
}, [toast]);
```

---

### Step 3.3: Update onSubmit Function

**Location:** Inside `onSubmit` function

**Add at the start:**
```typescript
// Check if offline
if (isOffline()) {
  toast({
    title: 'No Internet Connection',
    description: 'Please check your connection and try again.',
    variant: 'destructive',
  });
  return;
}

setIsSubmitting(true);
setRetryCount(0);

const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email: data.email });
```

**Find the fetch call:**
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: data.email,
    password: data.password,
    tenantSlug: tenant.slug,
  }),
});
```

**Replace with:**
```typescript
const url = `${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`;

authFlowLogger.logFetchAttempt(flowId, url, 1);
const fetchStartTime = performance.now();

const { response, attempts, category } = await resilientFetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: data.email,
    password: data.password,
    tenantSlug: tenant.slug,
  }),
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000,
  },
  onRetry: (attempt, error) => {
    setRetryCount(attempt);
    const delay = 1000 * Math.pow(2, attempt - 1);
    authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
    toast({
      title: 'Retrying...',
      description: `Attempt ${attempt} of 3`,
      duration: 2000,
    });
  },
  onError: (errorCategory) => {
    authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, attempts);
  },
});
```

**Add after successful response:**
```typescript
authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);
```

**Add before redirect:**
```typescript
authFlowLogger.logStep(flowId, AuthFlowStep.REDIRECT);
authFlowLogger.completeFlow(flowId, { tenantId: authResponse.tenant?.id });
```

**Update error handling:**
```typescript
} catch (error: any) {
  const category = error.message?.includes('Network') || error.message?.includes('fetch')
    ? ErrorCategory.NETWORK
    : ErrorCategory.AUTH;
  
  logger.error('Login error', error);
  toast({
    title: 'Login Failed',
    description: getErrorMessage(category, error) || error.message || 'Invalid email or password',
    variant: 'destructive',
  });
} finally {
  setIsSubmitting(false);
  setRetryCount(0);
}
```

---

### Step 3.4: Add Connection Status UI

**Location:** Inside the Card component, before the form

**Add:**
```typescript
{/* Connection Status Indicator */}
{connectionStatus === 'offline' && (
  <Alert className="mb-4 border-destructive/50 bg-destructive/10">
    <WifiOff className="h-4 w-4" />
    <AlertDescription>
      No internet connection. Please check your network and try again.
    </AlertDescription>
  </Alert>
)}
{retryCount > 0 && connectionStatus === 'online' && (
  <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
    <AlertCircle className="h-4 w-4 text-yellow-600" />
    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
      Retrying connection... (Attempt {retryCount} of 3)
    </AlertDescription>
  </Alert>
)}
```

**Add imports:**
```typescript
import { WifiOff, AlertCircle } from 'lucide-react';
```

---

## Phase 4: Testing & Verification

### Step 4.1: Test Network Resilience

1. **Test Retry Logic:**
   - Disconnect network during login
   - Verify retry attempts are logged
   - Reconnect network
   - Verify login completes

2. **Test Error Categorization:**
   - Test with invalid credentials (AUTH error)
   - Test with network disconnected (NETWORK error)
   - Test with server error (SERVER error)

3. **Test Connection Status:**
   - Toggle network on/off
   - Verify connection status updates
   - Verify UI indicators show correctly

### Step 4.2: Test Auth Flow Logging

1. **Check Logs:**
   - Open browser console
   - Attempt login
   - Verify flow steps are logged
   - Verify performance metrics are captured

2. **Test Error Logging:**
   - Cause a login failure
   - Verify error is logged with proper category
   - Verify error context is included

### Step 4.3: Test Token Verification

1. **Test Retry:**
   - Simulate network failure during verification
   - Verify retry logic works
   - Verify no infinite loops

2. **Test Timeout:**
   - Simulate slow network
   - Verify timeout handling works
   - Verify proper error messages

---

## Phase 5: Code Quality

### Step 5.1: Replace Console Errors

**Find all `console.error` calls in admin pages and replace with `logger.error`:**

**Example:**
```typescript
// Before
console.error('Error loading invoices:', error);

// After
import { logger } from '@/lib/logger';
logger.error('Error loading invoices', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerInvoices' });
```

**Files to check:**
- `src/pages/admin/CustomerInvoices.tsx` ✅ (already fixed)
- Other admin pages as needed

---

## Implementation Checklist

- [ ] Phase 1: Create network resilience utilities
  - [ ] Create `networkResilience.ts`
  - [ ] Create `authFlowLogger.ts`
- [ ] Phase 2: Update TenantAdminAuthContext
  - [ ] Add imports
  - [ ] Initialize connection monitoring
  - [ ] Add connection status state
  - [ ] Update initialization verification
  - [ ] Update token verification
  - [ ] Update token refresh in verifyToken
  - [ ] Update login function
  - [ ] Update logout function
  - [ ] Update refreshAuthToken function
  - [ ] Update subscription change verification
  - [ ] Export connection status
- [ ] Phase 3: Update SaaS LoginPage (Main Entry Point)
  - [ ] Verify network resilience is implemented (may already be done)
  - [ ] Add imports (if missing)
  - [ ] Add state and connection monitoring (if missing)
  - [ ] Update onSubmit function with resilientFetch (if missing)
  - [ ] Add connection status UI (if missing)
  - [ ] **Note:** This is the primary login page that routes through auth context
- [ ] Phase 4: Testing & Verification
  - [ ] Test network resilience on SaaS login page
  - [ ] Test network resilience in auth context
  - [ ] Test auth flow logging
  - [ ] Test token verification
- [ ] Phase 5: Code Quality
  - [ ] Replace console errors with logger

---

## Key Files Reference

1. **Network Resilience:**
   - `src/lib/utils/networkResilience.ts` (410 lines)
   - Key exports: `resilientFetch`, `ErrorCategory`, `getErrorMessage`, `initConnectionMonitoring`

2. **Auth Flow Logging:**
   - `src/lib/utils/authFlowLogger.ts` (244 lines)
   - Key exports: `authFlowLogger`, `AuthFlowStep`, `AuthAction`

3. **Auth Context:**
   - `src/contexts/TenantAdminAuthContext.tsx` (927 lines)
   - Key changes: All `safeFetch` → `resilientFetch`

4. **SaaS Login Page (Main Entry Point):**
   - `src/pages/saas/LoginPage.tsx` (605 lines)
   - **Status:** ✅ Already implemented with network resilience
   - Key features: Network resilience integration, connection status UI, retry logic
   - **Note:** This is the primary login page that routes through the auth context

5. **Tenant-Specific Login Page:**
   - `src/pages/tenant-admin/LoginPage.tsx` (227 lines)
   - **Note:** Uses `useTenantAdminAuth().login()` which already has network resilience

---

## Common Issues & Solutions

### Issue: "Illegal invocation" errors
**Solution:** Use `safeFetch` (bound fetch) or `resilientFetch` instead of raw `fetch()`

### Issue: Infinite retry loops
**Solution:** Ensure `maxRetries` is set correctly and retry logic checks attempt count

### Issue: AbortController conflicts
**Solution:** Remove external AbortController, let `resilientFetch` handle timeouts internally

### Issue: Connection status not updating
**Solution:** Ensure `initConnectionMonitoring()` is called and `onConnectionStatusChange` is subscribed

### Issue: Logs not appearing
**Solution:** Check that `logger` is imported from `@/lib/logger` (not `@/utils/logger`)

---

## Success Criteria

✅ All fetch calls use `resilientFetch` with retry logic
✅ Error categorization works correctly
✅ Connection status monitoring works
✅ Auth flow logging captures all steps
✅ No console errors (use logger instead)
✅ Login works reliably with network interruptions
✅ Token verification retries on failure
✅ User sees clear error messages

---

## Next Steps After Implementation

1. **Monitor Logs:** Check browser console and server logs for auth flow metrics
2. **Track Errors:** Monitor error categories to identify patterns
3. **Performance:** Track auth flow durations to identify bottlenecks
4. **User Feedback:** Collect feedback on error messages clarity

---

## Support

If you encounter issues during implementation:
1. Check the reference files listed above
2. Review the error messages in browser console
3. Verify all imports are correct
4. Ensure TypeScript types match
5. Test with network throttling to verify retry logic

---

**Last Updated:** Based on implementation completed in current codebase
**Version:** 1.0
