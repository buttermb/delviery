# Complete Verification Prompt for Lovable

## 🎯 Single Comprehensive Prompt (Copy This Entire Block)

```
I've just implemented comprehensive signup and authentication improvements. I need you to verify everything is properly integrated. Please check each item below and report any issues.

## SECURITY FEATURES

### 1. httpOnly Cookies
Check these files:
- supabase/functions/tenant-signup/index.ts:
  * Tokens set as httpOnly cookies in Set-Cookie headers (NOT in response body)
  * Cookies have: Secure, SameSite=Strict, HttpOnly attributes
  * Access token: 7 days, Refresh token: 30 days
- supabase/functions/tenant-admin-auth/index.ts:
  * 'verify' action: Checks Cookie header first, falls back to Authorization header
  * 'logout' action: Clears cookies by setting Max-Age=0
- src/contexts/TenantAdminAuthContext.tsx:
  * Initialization: Uses credentials:'include' in fetch calls
  * Has isAuthenticated state (boolean)
  * handleSignupSuccess: Sets state, stores user/tenant data (NOT tokens)
  * verifyToken: Uses credentials:'include', checks cookies
- src/pages/saas/SignUpPage.tsx:
  * NO localStorage.setItem calls for tokens
  * Uses handleSignupSuccess from auth context

### 2. Rate Limiting
Check supabase/functions/tenant-signup/index.ts:
- Imports checkRateLimit from ../_shared/rateLimiting.ts
- Rate limit checked BEFORE any database operations
- Uses IP+email combination as key
- Limit: 3 signups/hour (configurable via RATE_LIMIT_MAX_SIGNUPS_PER_HOUR)
- Returns 429 status with retryAfter header when exceeded
- Gracefully degrades if Redis unavailable (fail-open)

### 3. CAPTCHA Integration
Check both files:
- supabase/functions/tenant-signup/index.ts:
  * TenantSignupSchema includes captchaToken field
  * Verifies token with Cloudflare Turnstile API
  * Returns 400 if verification fails
  * Optional (can be made required)
- src/pages/saas/SignUpPage.tsx:
  * Imports Turnstile from @marsidev/react-turnstile
  * Turnstile component rendered after password field
  * captchaToken state included in form submission
  * Resets CAPTCHA on error (turnstileRef.current.reset())
- Environment: VITE_TURNSTILE_SITE_KEY (frontend), TURNSTILE_SECRET_KEY (backend)

## PERFORMANCE OPTIMIZATIONS

### 4. React Router Navigation (No Page Reload)
Check src/pages/saas/SignUpPage.tsx:
- After successful signup, uses navigate() from react-router-dom
- Does NOT use window.location.href
- Navigation includes: replace: true, state: { fromSignup: true, showWelcome: true }
- src/hooks/usePrefetchDashboard.ts:
  * Exists and exports usePrefetchDashboard hook
  * Prefetches dashboard data (metrics, orders, usage stats)
  * Called before navigation (non-blocking, doesn't await)

### 5. Atomic Database Function
Check:
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql:
  * Creates create_tenant_atomic function
  * Performs all operations in single transaction:
    - Insert tenant
    - Insert tenant_user (with email_verified: false, expires_at: NOW() + 7 days)
    - Insert subscription_event
  * Returns all created data as JSONB
  * Idempotent (can run multiple times)
- supabase/functions/tenant-signup/index.ts:
  * Calls supabase.rpc('create_tenant_atomic', {...})
  * Replaces sequential database calls
  * Handles rollback: deletes auth user if atomic function fails

### 6. Background Tasks
Check supabase/functions/tenant-signup/index.ts:
- After setting cookies and creating response:
  * Background tasks wrapped in Promise.allSettled([...])
  * NOT awaited (non-blocking)
  * Includes:
    - Email verification link generation (supabase.auth.admin.generateLink)
    - Welcome email sending (if Klaviyo configured)
    - Analytics tracking
  * All have error handling (catch blocks)
  * Errors don't fail signup response

### 7. Skeleton Loading Components
Check:
- src/components/loading/SkeletonAdminLayout.tsx:
  * Exists, shows sidebar, header, content placeholders
- src/components/loading/SkeletonDashboard.tsx:
  * Exists, shows metrics cards, charts, activity placeholders
- src/App.tsx:
  * Imports both skeleton components
  * Uses SkeletonAdminLayout for admin routes
  * Uses SkeletonDashboard for dashboard route
  * <Suspense fallback={<SkeletonDashboard />}> around dashboard

### 8. Route Prefetching
Check:
- src/hooks/useRoutePrefetch.ts:
  * Exists, exports useRoutePrefetch hook
  * Prefetches data on hover/focus (100ms debounce)
  * Handles errors gracefully
- src/components/tenant-admin/TenantAdminSidebar.tsx:
  * Imports and uses useRoutePrefetch
  * NavLink components have onMouseEnter and onFocus handlers
  * Calls prefetchRoute() with route path

## UX ENHANCEMENTS

### 9. Email Verification (Hybrid Approach)
Check:
- supabase/migrations/20251111183615_add_email_verification.sql:
  * Adds columns to tenant_users:
    - email_verified (BOOLEAN, default false)
    - email_verification_sent_at (TIMESTAMPTZ)
    - email_verification_token_expires_at (TIMESTAMPTZ)
    - verification_reminder_sent (BOOLEAN, default false)
  * Creates indexes for faster queries
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql:
  * Sets email_verified: false when creating tenant_user
  * Sets email_verification_token_expires_at: NOW() + INTERVAL '7 days'
- supabase/functions/tenant-signup/index.ts:
  * email_confirm: false when creating auth user
  * Generates verification link via supabase.auth.admin.generateLink
  * Sends verification email in background (non-blocking)
  * Updates email_verification_sent_at timestamp

### 10. Welcome Modal
Check:
- src/components/onboarding/WelcomeModal.tsx:
  * Exists, shows welcome message with tenant name
  * Has three buttons: 'Get Started', 'Take Tour', 'Skip'
  * Uses sessionStorage to remember if user has seen it
  * 'Take Tour' calls startTutorial('dashboard-tour', true)
  * Imports useTutorialContext from TutorialProvider
- src/pages/tenant-admin/DashboardPage.tsx:
  * Imports WelcomeModal
  * Checks location.state for fromSignup or showWelcome
  * Shows modal after 500ms delay
  * Clears state after showing (prevents showing on refresh)
  * Renders <WelcomeModal open={showWelcomeModal} onClose={...} />

## INTEGRATION POINTS

### 11. Auth Context Integration
Check src/contexts/TenantAdminAuthContext.tsx:
- Has isAuthenticated state (boolean)
- Has handleSignupSuccess method:
  * Accepts signup result
  * Sets admin and tenant state
  * Sets isAuthenticated: true
  * Stores user/tenant data in localStorage (NOT tokens)
- Initialization:
  * Uses credentials:'include' in fetch
  * Verifies via API call (cookies sent automatically)
  * Sets isAuthenticated based on verification result
- verifyToken:
  * Uses credentials:'include'
  * Checks cookies first, falls back to Authorization header
- Context value includes: isAuthenticated, handleSignupSuccess

### 12. Database Migrations
Check both migrations exist:
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql
- supabase/migrations/20251111183615_add_email_verification.sql
Both should be:
- Proper PostgreSQL syntax
- Idempotent (can run multiple times safely)
- Ready to run in Supabase

## CODE QUALITY

### 13. TypeScript & Linting
Check all new/modified files:
- No TypeScript errors
- No @ts-nocheck in new files
- Proper types (no 'any', use 'unknown' if needed)
- Uses logger, not console.log
- Imports properly organized
- No unused imports

Files to check:
- src/hooks/usePrefetchDashboard.ts
- src/hooks/useRoutePrefetch.ts
- src/components/loading/SkeletonAdminLayout.tsx
- src/components/loading/SkeletonDashboard.tsx
- src/components/onboarding/WelcomeModal.tsx
- All modified files

## END-TO-END FLOW

### 14. Complete Signup Flow
Trace through:
1. User fills form → CAPTCHA appears → Form validates
2. Submit → Rate limit checked → CAPTCHA verified → httpOnly cookies set → Background tasks start
3. Navigate (React Router, no reload) → Dashboard prefetches → Welcome modal appears → User authenticated

Verify each step works correctly.

### 15. Error Handling
Verify:
- Rate limit exceeded: 429 with retryAfter, user-friendly message
- CAPTCHA failure: 400, resets CAPTCHA, clear error message
- Database errors: Rollback (deletes auth user), user-friendly messages
- Network errors: Caught, form state preserved, user-friendly messages
- All errors logged with logger.error(), not console.error()

## BACKWARDS COMPATIBILITY

### 16. Backwards Compatibility
Check:
- TenantAdminAuthContext still has token, accessToken, refreshToken (for backwards compat)
- verifyToken checks Authorization header if cookies not found
- Existing code using accessToken should still work
- Logout works for both cookie and header-based auth

## ENVIRONMENT VARIABLES

### 17. Environment Variables
Verify:
- Frontend: VITE_SUPABASE_URL, VITE_TURNSTILE_SITE_KEY
- Supabase Secrets: TURNSTILE_SECRET_KEY, JWT_SECRET
- Optional: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, RATE_LIMIT_MAX_SIGNUPS_PER_HOUR, KLAVIYO_API_KEY, SITE_URL
- Code handles missing optional vars gracefully

## FINAL CHECK

### 18. Complete Integration Report
Please provide:
1. List of all 10 created files - confirm they exist
2. List of all 7 modified files - confirm changes are correct
3. Check all imports are correct (no broken references)
4. Verify features work together:
   - Signup → Cookies → Navigation → Dashboard → Welcome Modal
   - Rate limit → CAPTCHA → Atomic DB → Background tasks
   - Prefetch → Skeleton → Dashboard load
5. Any issues or missing implementations
6. Any recommendations for improvements

Please be thorough and check each point systematically.
```

---

## 🎯 Alternative: Step-by-Step Approach

If you prefer to ask questions one at a time, use this order:

### Step 1: Security Foundation
```
Start with: "Can you verify httpOnly cookies are implemented correctly? Check [list files]..."
```

### Step 2: Performance
```
Then: "Verify React Router navigation and prefetching in SignUpPage..."
```

### Step 3: Database
```
Then: "Check if atomic database function exists and is being used..."
```

### Step 4: UX
```
Then: "Verify welcome modal appears after signup..."
```

### Step 5: Integration
```
Finally: "Provide a complete integration report..."
```

---

## 📋 Quick Checklist Format

**For each feature, ask Lovable:**

1. **Does [feature] exist?** (File exists, code present)
2. **Is it implemented correctly?** (Matches requirements)
3. **Is it integrated?** (Works with other features)
4. **Are there any issues?** (Errors, missing pieces)

---

## ✅ Success Indicators

**Lovable should confirm:**
- ✅ All files exist and are correct
- ✅ All features implemented as specified
- ✅ No broken references or imports
- ✅ Features work together
- ✅ Code quality is good
- ✅ Ready for deployment

---

**Use the comprehensive prompt above for a complete verification in one go, or use the step-by-step approach for more detailed investigation.**

