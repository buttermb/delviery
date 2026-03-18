# Lovable AI Quick Start: Network Resilience Implementation

## TL;DR - What to Do

1. **Create two utility files** (copy from codebase)
2. **Update TenantAdminAuthContext** (replace 6 `safeFetch` calls)
3. **Update LoginPage** (add retry logic and connection status)
4. **Test** (verify retries work)

---

## Step 1: Copy Utility Files

### File 1: `src/lib/utils/networkResilience.ts`
- **Action:** Copy entire file from codebase
- **Size:** ~410 lines
- **Key Export:** `resilientFetch` function

### File 2: `src/lib/utils/authFlowLogger.ts`
- **Action:** Copy entire file from codebase
- **Size:** ~244 lines
- **Key Export:** `authFlowLogger` singleton

---

## Step 2: Update TenantAdminAuthContext

### Add Imports (Line ~7)
```typescript
import { resilientFetch, safeFetch, ErrorCategory, getErrorMessage, initConnectionMonitoring, onConnectionStatusChange, type ConnectionStatus } from "@/lib/utils/networkResilience";
import { authFlowLogger, AuthFlowStep, AuthAction } from "@/lib/utils/authFlowLogger";
```

### Initialize Connection Monitoring (After validateEnvironment)
```typescript
if (typeof window !== 'undefined') {
  initConnectionMonitoring();
}
```

### Add Connection Status State
```typescript
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');

useEffect(() => {
  const unsubscribe = onConnectionStatusChange((status) => {
    setConnectionStatus(status);
  });
  return unsubscribe;
}, []);
```

### Replace All `safeFetch` with `resilientFetch`

**Location 1: Initialization (Line ~220)**
```typescript
// OLD:
const verifyResponse = await safeFetch(url, {...});

// NEW:
const { response: verifyResponse } = await resilientFetch(url, {
  ...options,
  timeout: 10000,
  retryConfig: { maxRetries: 1, initialDelay: 500 },
});
```

**Location 2: Token Verification (Line ~355)**
```typescript
// OLD:
response = await safeFetch(url, { signal: controller.signal });

// NEW:
const { response: resilientResponse } = await resilientFetch(url, {
  ...options,
  timeout: VERIFY_TIMEOUT_MS,
  retryConfig: { maxRetries: retryCount < maxRetries ? 1 : 0, initialDelay: 500 },
});
response = resilientResponse;
// Remove AbortController code
```

**Location 3: Token Refresh in verifyToken (Line ~404)**
```typescript
// OLD:
const refreshResponse = await safeFetch(url, {...});

// NEW:
const { response: refreshResponse } = await resilientFetch(url, {
  ...options,
  timeout: 10000,
  retryConfig: { maxRetries: 1, initialDelay: 500 },
});
```

**Location 4: Login (Line ~557)**
```typescript
// OLD:
const response = await safeFetch(url, { signal: controller.signal });

// NEW:
const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email, tenantSlug });
authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);

const { response, attempts, category } = await resilientFetch(url, {
  ...options,
  timeout: 30000,
  retryConfig: { maxRetries: 3, initialDelay: 1000 },
  onRetry: (attempt, error) => {
    authFlowLogger.logFetchRetry(flowId, url, attempt, error, delay);
  },
});

// After success:
authFlowLogger.completeFlow(flowId, { tenantId: data.tenant?.id });

// In catch:
authFlowLogger.failFlow(flowId, error, category);
```

**Location 5: Logout (Line ~632)**
```typescript
// OLD:
await safeFetch(url, {...});

// NEW:
await resilientFetch(url, {
  ...options,
  timeout: 10000,
  retryConfig: { maxRetries: 1, initialDelay: 500 },
});
```

**Location 6: refreshAuthToken (Line ~745)**
```typescript
// OLD:
const response = await safeFetch(url, { signal: controller.signal });

// NEW:
const { response } = await resilientFetch(url, {
  ...options,
  timeout: 10000,
  retryConfig: { maxRetries: 2, initialDelay: 1000 },
});
// Remove AbortController code
```

**Location 7: Subscription Change (Line ~834)**
```typescript
// OLD:
const response = await safeFetch(url, {...});

// NEW:
const { response } = await resilientFetch(url, {
  ...options,
  timeout: 10000,
  retryConfig: { maxRetries: 1, initialDelay: 500 },
});
```

### Export Connection Status
```typescript
// In context value:
connectionStatus,

// In interface:
connectionStatus: ConnectionStatus;
```

---

## Step 3: Update SaaS LoginPage

**Note:** The SaaS login page (`src/pages/saas/LoginPage.tsx`) is the main entry point. If it's already implemented, verify it matches the pattern below.

### Add Imports
```typescript
import { resilientFetch, ErrorCategory, getErrorMessage, onConnectionStatusChange, type ConnectionStatus, isOffline } from '@/lib/utils/networkResilience';
import { authFlowLogger, AuthFlowStep, AuthAction } from '@/lib/utils/authFlowLogger';
import { WifiOff, AlertCircle } from 'lucide-react';
```

### Add State
```typescript
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
const [retryCount, setRetryCount] = useState(0);

useEffect(() => {
  const unsubscribe = onConnectionStatusChange((status) => {
    setConnectionStatus(status);
    if (status === 'offline') {
      toast({ title: 'No Internet Connection', variant: 'destructive' });
    }
  });
  return unsubscribe;
}, [toast]);
```

### Update onSubmit
```typescript
// Add at start:
if (isOffline()) {
  toast({ title: 'No Internet Connection', variant: 'destructive' });
  return;
}

const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email: data.email });

// Replace fetch:
const { response, attempts, category } = await resilientFetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, tenantSlug }),
  timeout: 30000,
  retryConfig: { maxRetries: 3, initialDelay: 1000 },
  onRetry: (attempt) => {
    setRetryCount(attempt);
    toast({ title: 'Retrying...', description: `Attempt ${attempt} of 3` });
  },
});

// Update error handling:
const category = error.message?.includes('Network') ? ErrorCategory.NETWORK : ErrorCategory.AUTH;
toast({ description: getErrorMessage(category, error) });
```

### Add UI Indicators
```typescript
{connectionStatus === 'offline' && (
  <Alert className="mb-4">
    <WifiOff className="h-4 w-4" />
    <AlertDescription>No internet connection</AlertDescription>
  </Alert>
)}
{retryCount > 0 && (
  <Alert className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>Retrying... (Attempt {retryCount} of 3)</AlertDescription>
  </Alert>
)}
```

---

## Step 4: Test

1. **Disconnect network during login** → Should retry 3 times
2. **Check console logs** → Should see auth flow steps
3. **Toggle network on/off** → Should see connection status updates
4. **Test with slow network** → Should timeout and retry

---

## Quick Reference

| Operation | Max Retries | Timeout | Initial Delay |
|-----------|-------------|---------|---------------|
| Login | 3 | 30s | 1000ms |
| Token Verify | 1 | 8s | 500ms |
| Token Refresh | 2 | 10s | 1000ms |
| Logout | 1 | 10s | 500ms |
| Init | 1 | 10s | 500ms |

---

## Common Mistakes to Avoid

❌ **Don't** use raw `fetch()` - use `resilientFetch`
❌ **Don't** keep AbortController when using `resilientFetch`
❌ **Don't** forget to remove `clearTimeout()` calls
❌ **Don't** use `console.error` - use `logger.error`
❌ **Don't** forget to export `connectionStatus` in context

---

## Files to Modify

1. ✅ `src/lib/utils/networkResilience.ts` (create)
2. ✅ `src/lib/utils/authFlowLogger.ts` (create)
3. ✅ `src/contexts/TenantAdminAuthContext.tsx` (modify)
4. ✅ `src/pages/saas/LoginPage.tsx` (modify - **Main login entry point**)

**Note:** The SaaS login page is the primary entry point for tenant admin login. It routes through `TenantAdminAuthContext`, so both need network resilience.

---

## Done! ✅

After these changes:
- Login will retry automatically on network failures
- Users see clear error messages
- Connection status is monitored
- All auth flows are logged for debugging

