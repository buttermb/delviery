

# Fix React Error #310: "Rendered more hooks than during the previous render"

## Root Cause

React error #310 decodes to: **"Rendered more hooks than during the previous render."** This is a hooks ordering violation — a component is calling a different number of hooks between renders.

## Most Likely Source

The browser console shows dozens of **"Function components cannot be given refs"** warnings across nearly every provider in the App component tree (QueryClientProvider, FeatureFlagsProvider, ThemeProvider, AuthProvider, AccountProvider, EncryptionProvider, TenantAdminAuthProvider, etc.). These warnings indicate that function components are being passed refs they can't accept. While these are warnings (not crashes), they can destabilize React's internal hook tracking in production builds, leading to #310.

The pattern is consistent: every context provider wrapped in `App.tsx` triggers this warning. This suggests the `ErrorBoundary` component (line 258 in `ErrorBoundary.tsx`) is passing a `ref` to function components that don't support `forwardRef`.

## Fix Plan

### 1. Check ErrorBoundary ref forwarding
**File**: `src/components/ErrorBoundary.tsx` (line ~258)
- Inspect how ErrorBoundary wraps its children — if it passes a `ref` to function component children, that triggers the warnings and can cause hook ordering issues in production.
- Remove any `ref` prop being passed to children, or wrap children properly.

### 2. Wrap context providers with `forwardRef` (if needed)
If the ErrorBoundary legitimately needs refs, the providers need `forwardRef`. But the simpler fix is to stop the ErrorBoundary from passing refs to its children.

**Estimated scope**: 1-2 files. The fix should eliminate both the ref warnings and the #310 error.

