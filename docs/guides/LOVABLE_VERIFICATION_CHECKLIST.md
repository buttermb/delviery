# Lovable Verification Checklist - Signup & Auth Integration

## Purpose
This document provides a comprehensive list of questions to ask Lovable AI to verify that all signup and authentication improvements are properly integrated and working correctly.

---

## 🔒 Security Features Verification

### 1. httpOnly Cookies Implementation

**Ask Lovable:**
```
"Can you verify that httpOnly cookies are properly implemented for authentication? 
Specifically check:

1. In `supabase/functions/tenant-signup/index.ts`:
   - Are tokens being set as httpOnly cookies in the response headers?
   - Are cookies set with Secure, SameSite=Strict attributes?
   - Are tokens NO LONGER returned in the response body?

2. In `supabase/functions/tenant-admin-auth/index.ts`:
   - Does the 'verify' action check cookies first (via Cookie header)?
   - Does it fall back to Authorization header for backwards compatibility?
   - Does the 'logout' action clear cookies by setting Max-Age=0?

3. In `src/contexts/TenantAdminAuthContext.tsx`:
   - Does initialization use `credentials: 'include'` in fetch calls?
   - Is `isAuthenticated` state being set correctly?
   - Does `handleSignupSuccess` NOT store tokens in localStorage?

4. In `src/pages/saas/SignUpPage.tsx`:
   - Are there any `localStorage.setItem` calls for tokens?
   - Does it use `handleSignupSuccess` from auth context?

Please check each file and confirm the implementation matches these requirements."
```

**Expected Results:**
- ✅ Tokens set as httpOnly cookies (not in response body)
- ✅ Cookies have Secure, SameSite=Strict attributes
- ✅ No localStorage token storage in SignUpPage
- ✅ Auth context uses `credentials: 'include'`
- ✅ Verification checks cookies first

---

### 2. Rate Limiting

**Ask Lovable:**
```
"In `supabase/functions/tenant-signup/index.ts`, verify that rate limiting is implemented:

1. Is `checkRateLimit` imported from `../_shared/rateLimiting.ts`?
2. Is rate limiting checked BEFORE any database operations?
3. Does it use IP+email combination as the key?
4. Is the limit configurable via `RATE_LIMIT_MAX_SIGNUPS_PER_HOUR` env var?
5. Does it return 429 status with retryAfter header when limit exceeded?
6. Does it gracefully degrade if Redis is unavailable (fail-open)?

Check the exact implementation and confirm it follows this pattern."
```

**Expected Results:**
- ✅ Rate limiting checked early in the function
- ✅ Uses IP+email as key
- ✅ Returns 429 with retryAfter
- ✅ Graceful degradation if Redis unavailable

---

### 3. CAPTCHA Integration

**Ask Lovable:**
```
"Verify CAPTCHA integration in both frontend and backend:

1. In `supabase/functions/tenant-signup/index.ts`:
   - Is `captchaToken` in the request schema (TenantSignupSchema)?
   - Is it verified with Cloudflare Turnstile API?
   - Does it return 400 if verification fails?
   - Is it optional (can be made required later)?

2. In `src/pages/saas/SignUpPage.tsx`:
   - Is the Turnstile component imported from `@marsidev/react-turnstile`?
   - Is it rendered after the password field?
   - Does it reset on error?
   - Is `captchaToken` state included in the form submission?

3. Check that `VITE_TURNSTILE_SITE_KEY` is used in the frontend.
4. Check that `TURNSTILE_SECRET_KEY` is used in the edge function.

Please verify all these points."
```

**Expected Results:**
- ✅ CAPTCHA component in SignUpPage
- ✅ Token sent to edge function
- ✅ Backend verifies with Cloudflare API
- ✅ Error handling and reset logic

---

## ⚡ Performance Optimizations Verification

### 4. React Router Navigation (No Page Reload)

**Ask Lovable:**
```
"In `src/pages/saas/SignUpPage.tsx`, verify navigation implementation:

1. After successful signup, does it use `navigate()` from react-router-dom?
2. Is `window.location.href` NOT used for navigation?
3. Does navigation include state: `{ fromSignup: true, showWelcome: true }`?
4. Is `replace: true` used to prevent back button issues?

Also check:
- Does `src/hooks/usePrefetchDashboard.ts` exist and prefetch dashboard data?
- Is prefetch called before navigation (non-blocking)?

Please confirm the navigation flow uses React Router, not full page reload."
```

**Expected Results:**
- ✅ Uses `navigate()` not `window.location.href`
- ✅ Includes navigation state
- ✅ Dashboard prefetching implemented
- ✅ No full page reload

---

### 5. Atomic Database Function

**Ask Lovable:**
```
"Verify the atomic database function implementation:

1. Does `supabase/migrations/20251111183614_create_tenant_atomic_function.sql` exist?
2. Does it create a function called `create_tenant_atomic`?
3. Does the function perform all operations in a single transaction:
   - Insert tenant
   - Insert tenant_user
   - Insert subscription_event
4. Does it return all created data as JSONB?

5. In `supabase/functions/tenant-signup/index.ts`:
   - Is the atomic function called via `supabase.rpc('create_tenant_atomic', {...})`?
   - Are sequential database calls replaced with the RPC call?
   - Is rollback handled if atomic function fails (deletes auth user)?

Please verify the function exists and is being used correctly."
```

**Expected Results:**
- ✅ Migration file exists
- ✅ Function creates all records atomically
- ✅ Edge function uses RPC call
- ✅ Proper rollback on failure

---

### 6. Background Tasks

**Ask Lovable:**
```
"In `supabase/functions/tenant-signup/index.ts`, verify background tasks:

1. After setting cookies and creating response, are there background tasks?
2. Are they wrapped in `Promise.allSettled([...])`?
3. Are they NOT awaited (non-blocking)?
4. Do they include:
   - Email verification link generation and sending
   - Welcome email sending (if Klaviyo configured)
   - Analytics tracking

5. Do background tasks have proper error handling (catch blocks)?
6. Do errors in background tasks NOT fail the signup response?

Please check that background tasks don't block the response."
```

**Expected Results:**
- ✅ Background tasks use Promise.allSettled
- ✅ Not awaited (non-blocking)
- ✅ Proper error handling
- ✅ Don't fail signup if they error

---

### 7. Skeleton Loading Components

**Ask Lovable:**
```
"Verify skeleton loading components exist and are used:

1. Does `src/components/loading/SkeletonAdminLayout.tsx` exist?
   - Does it show sidebar, header, and content placeholders?

2. Does `src/components/loading/SkeletonDashboard.tsx` exist?
   - Does it show metrics cards, charts, and activity placeholders?

3. In `src/App.tsx`:
   - Are these skeleton components imported?
   - Are they used as Suspense fallbacks for admin routes?
   - Specifically check the dashboard route fallback.

Please verify skeleton components are properly integrated."
```

**Expected Results:**
- ✅ Skeleton components exist
- ✅ Used as Suspense fallbacks
- ✅ Professional loading states

---

### 8. Route Prefetching

**Ask Lovable:**
```
"Verify route prefetching implementation:

1. Does `src/hooks/useRoutePrefetch.ts` exist?
   - Does it prefetch data on hover/focus?
   - Is it debounced (100ms delay)?
   - Does it handle errors gracefully?

2. In `src/components/tenant-admin/TenantAdminSidebar.tsx`:
   - Is `useRoutePrefetch` hook imported and used?
   - Do NavLink components have `onMouseEnter` and `onFocus` handlers?
   - Do they call `prefetchRoute()` with the route path?

Please verify prefetching works on sidebar navigation links."
```

**Expected Results:**
- ✅ Prefetch hook exists
- ✅ Sidebar links have hover/focus handlers
- ✅ Data prefetched before click

---

## 🎨 UX Enhancements Verification

### 9. Email Verification (Hybrid Approach)

**Ask Lovable:**
```
"Verify email verification implementation:

1. Does `supabase/migrations/20251111183615_add_email_verification.sql` exist?
   - Does it add `email_verified`, `email_verification_sent_at`, 
     `email_verification_token_expires_at`, `verification_reminder_sent` columns?
   - Are indexes created for faster queries?

2. In `supabase/migrations/20251111183614_create_tenant_atomic_function.sql`:
   - Does it set `email_verified: false` when creating tenant_user?
   - Does it set `email_verification_token_expires_at: NOW() + 7 days`?

3. In `supabase/functions/tenant-signup/index.ts`:
   - Is `email_confirm: false` set when creating auth user?
   - Is verification link generated via `supabase.auth.admin.generateLink`?
   - Is verification email sent in background (non-blocking)?
   - Is `email_verification_sent_at` updated?

Please verify the hybrid approach (immediate access, 7-day deadline)."
```

**Expected Results:**
- ✅ Migration adds verification columns
- ✅ Atomic function sets email_verified: false
- ✅ Verification link generated
- ✅ Email sent in background

---

### 10. Welcome Modal

**Ask Lovable:**
```
"Verify welcome modal implementation:

1. Does `src/components/onboarding/WelcomeModal.tsx` exist?
   - Does it show welcome message with tenant name?
   - Does it have 'Get Started', 'Take Tour', and 'Skip' buttons?
   - Does it use sessionStorage to remember if user has seen it?

2. In `src/pages/tenant-admin/DashboardPage.tsx`:
   - Is WelcomeModal imported and rendered?
   - Does it check `location.state` for `fromSignup` or `showWelcome`?
   - Does it show the modal after a 500ms delay?
   - Does it clear state after showing (prevent showing on refresh)?

3. Does 'Take Tour' button start the dashboard tutorial?
   - Is `useTutorialContext` imported?
   - Does it call `startTutorial('dashboard-tour', true)`?

Please verify the welcome modal appears after signup and works correctly."
```

**Expected Results:**
- ✅ WelcomeModal component exists
- ✅ Integrated in DashboardPage
- ✅ Shows after signup
- ✅ Tutorial integration works

---

## 🔧 Integration Points Verification

### 11. Auth Context Integration

**Ask Lovable:**
```
"Verify TenantAdminAuthContext integration:

1. Does `src/contexts/TenantAdminAuthContext.tsx` have:
   - `isAuthenticated` state (boolean)?
   - `handleSignupSuccess` method?
   - Cookie-based verification in initialization?
   - `credentials: 'include'` in fetch calls?

2. Does `handleSignupSuccess`:
   - Accept signup result as parameter?
   - Set admin and tenant state?
   - Set `isAuthenticated: true`?
   - Store user/tenant data in localStorage (not tokens)?

3. Are all components using the context correctly?
   - Check if any components still check `accessToken` instead of `isAuthenticated`
   - Verify components use `handleSignupSuccess` after signup

Please verify the auth context is properly integrated throughout the app."
```

**Expected Results:**
- ✅ isAuthenticated state exists
- ✅ handleSignupSuccess implemented
- ✅ Components use new pattern
- ✅ No accessToken checks in components

---

### 12. Database Migrations

**Ask Lovable:**
```
"Verify database migrations are ready:

1. Does `supabase/migrations/20251111183614_create_tenant_atomic_function.sql` exist?
   - Check that it creates `create_tenant_atomic` function
   - Verify it's idempotent (uses IF NOT EXISTS or similar)
   - Check that it has proper error handling

2. Does `supabase/migrations/20251111183615_add_email_verification.sql` exist?
   - Check that it adds email verification columns
   - Verify indexes are created
   - Check that it's idempotent

3. Are migrations in the correct format for Supabase?
   - Do they use proper PostgreSQL syntax?
   - Are they numbered correctly (timestamp format)?

Please verify migrations are ready to run."
```

**Expected Results:**
- ✅ Both migrations exist
- ✅ Proper SQL syntax
- ✅ Idempotent (can run multiple times)
- ✅ Proper error handling

---

## 🧪 Testing Scenarios

### 13. End-to-End Signup Flow

**Ask Lovable:**
```
"Walk through the complete signup flow and verify:

1. User fills out signup form
   - Are all required fields validated?
   - Does CAPTCHA appear and work?
   - Is form data auto-saved to localStorage?

2. User submits form
   - Is rate limiting checked first?
   - Is CAPTCHA verified?
   - Are httpOnly cookies set in response?
   - Are tokens NOT in response body?
   - Are background tasks started (non-blocking)?

3. After successful signup
   - Does React Router navigate (no page reload)?
   - Does dashboard prefetch run?
   - Does welcome modal appear?
   - Is user authenticated (isAuthenticated: true)?
   - Are cookies accessible in DevTools?

Please trace through the entire flow and identify any issues."
```

**Expected Results:**
- ✅ Complete flow works end-to-end
- ✅ No page reload
- ✅ Welcome modal appears
- ✅ User authenticated

---

### 14. Error Handling

**Ask Lovable:**
```
"Verify error handling throughout the signup flow:

1. Rate limit exceeded:
   - Does it return 429 status?
   - Is retryAfter header included?
   - Is error message user-friendly?

2. CAPTCHA failure:
   - Does it return 400 status?
   - Is error message clear?
   - Does CAPTCHA reset on error?

3. Database errors:
   - Is rollback handled (auth user deleted)?
   - Are error messages user-friendly?
   - Are errors logged properly?

4. Network errors:
   - Are they caught and handled?
   - Are user-friendly messages shown?
   - Is form state preserved?

Please verify all error scenarios are handled gracefully."
```

**Expected Results:**
- ✅ All errors handled gracefully
- ✅ User-friendly error messages
- ✅ Proper logging
- ✅ Form state preserved

---

## 🔍 Code Quality Checks

### 15. TypeScript & Linting

**Ask Lovable:**
```
"Check code quality for all new/modified files:

1. TypeScript:
   - Are all new files properly typed?
   - No `any` types (use `unknown` if needed)?
   - Are interfaces defined for component props?

2. Linting:
   - Are there any `console.log` statements (should use logger)?
   - Are imports properly organized?
   - Are there any unused imports?

3. Files to check:
   - src/hooks/usePrefetchDashboard.ts
   - src/hooks/useRoutePrefetch.ts
   - src/components/loading/SkeletonAdminLayout.tsx
   - src/components/loading/SkeletonDashboard.tsx
   - src/components/onboarding/WelcomeModal.tsx
   - All modified files

Please verify code quality meets standards."
```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ No linter errors
- ✅ Proper types throughout
- ✅ Uses logger, not console.log

---

### 16. Environment Variables

**Ask Lovable:**
```
"Verify environment variables are properly configured:

1. Frontend (.env or build environment):
   - VITE_SUPABASE_URL
   - VITE_TURNSTILE_SITE_KEY

2. Supabase Edge Functions (secrets):
   - TURNSTILE_SECRET_KEY
   - JWT_SECRET
   - UPSTASH_REDIS_REST_URL (optional)
   - UPSTASH_REDIS_REST_TOKEN (optional)
   - RATE_LIMIT_MAX_SIGNUPS_PER_HOUR (optional)
   - KLAVIYO_API_KEY (optional)
   - SITE_URL (optional)

3. Check that code handles missing optional variables gracefully:
   - Does rate limiting fall back to in-memory if Redis unavailable?
   - Does CAPTCHA work if Turnstile keys are missing?
   - Are there proper fallbacks?

Please verify environment variable usage and fallbacks."
```

**Expected Results:**
- ✅ Required vars documented
- ✅ Optional vars have fallbacks
- ✅ Graceful degradation

---

## 🎯 Specific Integration Checks

### 17. Tutorial System Integration

**Ask Lovable:**
```
"Verify tutorial system integration:

1. In `src/components/onboarding/WelcomeModal.tsx`:
   - Is `useTutorialContext` imported from `@/components/tutorial/TutorialProvider`?
   - Does 'Take Tour' button call `startTutorial('dashboard-tour', true)`?
   - Does it work without errors?

2. In `src/pages/admin/AdminLayout.tsx`:
   - Is `TutorialProvider` wrapping the layout?
   - Is it available to all child components?

3. Check that tutorial context is accessible:
   - Can WelcomeModal access tutorial functions?
   - Does dashboard tutorial start correctly?

Please verify tutorial integration works end-to-end."
```

**Expected Results:**
- ✅ TutorialProvider wraps AdminLayout
- ✅ WelcomeModal can access tutorial context
- ✅ Dashboard tour starts correctly

---

### 18. Prefetch Integration

**Ask Lovable:**
```
"Verify prefetch integration:

1. In `src/pages/saas/SignUpPage.tsx`:
   - Is `usePrefetchDashboard` imported and used?
   - Is `prefetch()` called before navigation?
   - Is it non-blocking (doesn't await)?

2. In `src/hooks/usePrefetchDashboard.ts`:
   - Does it use `queryClient.prefetchQuery`?
   - Does it prefetch dashboard metrics, recent orders, usage stats?
   - Does it handle errors gracefully?

3. Check that prefetched data is actually used:
   - Does dashboard use the same query keys?
   - Is data available immediately when dashboard loads?

Please verify prefetching works and improves performance."
```

**Expected Results:**
- ✅ Prefetch called before navigation
- ✅ Non-blocking
- ✅ Dashboard uses prefetched data
- ✅ Performance improved

---

## 📋 Database Schema Verification

### 19. Email Verification Schema

**Ask Lovable:**
```
"Verify email verification schema changes:

1. Check `tenant_users` table:
   - Does it have `email_verified` column (BOOLEAN, default false)?
   - Does it have `email_verification_sent_at` (TIMESTAMPTZ)?
   - Does it have `email_verification_token_expires_at` (TIMESTAMPTZ)?
   - Does it have `verification_reminder_sent` (BOOLEAN, default false)?

2. Check indexes:
   - Is there an index on `email_verified`?
   - Is there an index for reminder queries?

3. Check atomic function:
   - Does it set `email_verified: false`?
   - Does it set expiration to 7 days from now?

Please verify schema changes are correct."
```

**Expected Results:**
- ✅ All columns exist
- ✅ Indexes created
- ✅ Atomic function sets values correctly

---

## 🔄 Backwards Compatibility

### 20. Backwards Compatibility

**Ask Lovable:**
```
"Verify backwards compatibility:

1. In `TenantAdminAuthContext`:
   - Are `token`, `accessToken`, `refreshToken` still available (for backwards compat)?
   - Does verification check Authorization header if cookies not found?
   - Can existing code still work?

2. In edge functions:
   - Does `tenant-admin-auth` verify action check both cookies and Authorization header?
   - Does it work with old clients that send tokens in headers?

3. Check that existing features still work:
   - Can users still log in with existing tokens?
   - Does logout work for both cookie and header-based auth?

Please verify backwards compatibility is maintained."
```

**Expected Results:**
- ✅ Old token-based auth still works
- ✅ New cookie-based auth works
- ✅ Graceful fallback between methods

---

## 🚨 Edge Cases

### 21. Edge Cases

**Ask Lovable:**
```
"Check edge cases and error scenarios:

1. What happens if:
   - Cookies are disabled in browser?
   - CAPTCHA service is down?
   - Redis is unavailable (rate limiting)?
   - Email service fails (background task)?
   - Database transaction fails (atomic function)?
   - User closes browser during signup?

2. Verify graceful degradation:
   - Does rate limiting fall back to in-memory?
   - Does CAPTCHA fail gracefully?
   - Do background task errors not break signup?
   - Are user-friendly error messages shown?

Please verify all edge cases are handled."
```

**Expected Results:**
- ✅ All edge cases handled
- ✅ Graceful degradation
- ✅ User-friendly errors

---

## 📊 Performance Verification

### 22. Performance Metrics

**Ask Lovable:**
```
"Verify performance improvements:

1. Navigation time:
   - Does signup → dashboard navigation take <500ms?
   - Is there no full page reload?
   - Is data prefetched?

2. Database operations:
   - Does tenant creation use atomic function?
   - Is it faster than sequential calls?
   - Are there fewer database round trips?

3. Background tasks:
   - Do they not block the response?
   - Is signup response time improved?

Please verify performance improvements are measurable."
```

**Expected Results:**
- ✅ Navigation <500ms
- ✅ Database operations faster
- ✅ Background tasks non-blocking

---

## 🎓 Final Comprehensive Check

### 23. Complete Integration Verification

**Ask Lovable:**
```
"Perform a complete integration check:

1. List all files created/modified in this implementation
2. Verify each file exists and has correct content
3. Check that all imports are correct
4. Verify no broken references
5. Check that all features work together:
   - Signup → Cookies → Navigation → Dashboard → Welcome Modal
   - Rate limiting → CAPTCHA → Atomic DB → Background tasks
   - Prefetch → Skeleton → Dashboard load

6. Verify documentation:
   - Are all documentation files present?
   - Do they accurately describe the implementation?

Please provide a comprehensive integration report."
```

**Expected Results:**
- ✅ All files present and correct
- ✅ No broken references
- ✅ Features work together
- ✅ Documentation complete

---

## 📝 Questions to Ask in Sequence

**Recommended order for asking Lovable:**

1. Start with security (most critical)
2. Then performance (user experience)
3. Then UX enhancements
4. Finally integration and edge cases

**Example conversation flow:**
```
1. "Can you verify httpOnly cookies are implemented correctly? Check [files]..."
2. "Now verify rate limiting in tenant-signup edge function..."
3. "Check CAPTCHA integration in both frontend and backend..."
4. "Verify React Router navigation (no page reload) in SignUpPage..."
5. "Check if atomic database function exists and is being used..."
6. "Verify welcome modal appears after signup..."
7. "Check that all environment variables are properly configured..."
8. "Verify backwards compatibility is maintained..."
9. "Check edge cases and error handling..."
10. "Provide a final integration report..."
```

---

## ✅ Success Criteria

**All checks should confirm:**
- ✅ Security: httpOnly cookies, rate limiting, CAPTCHA working
- ✅ Performance: Fast navigation, atomic DB, background tasks
- ✅ UX: Welcome modal, email verification, skeleton loading
- ✅ Integration: All components work together
- ✅ Quality: No errors, proper types, good practices
- ✅ Documentation: Complete and accurate

---

**Use this checklist systematically to verify the entire implementation is correct and integrated properly.**

