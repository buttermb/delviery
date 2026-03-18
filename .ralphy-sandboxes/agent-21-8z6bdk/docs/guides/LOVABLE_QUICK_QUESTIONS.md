# Quick Questions for Lovable - Copy & Paste Ready

## 🔒 Security Checks (Start Here)

### Question 1: httpOnly Cookies
```
Can you verify httpOnly cookies are implemented? Check:
- supabase/functions/tenant-signup/index.ts: tokens set as httpOnly cookies (not in body), Secure/SameSite=Strict
- supabase/functions/tenant-admin-auth/index.ts: verify checks cookies first, logout clears cookies
- src/contexts/TenantAdminAuthContext.tsx: uses credentials:'include', has isAuthenticated state
- src/pages/saas/SignUpPage.tsx: NO localStorage.setItem for tokens, uses handleSignupSuccess
```

### Question 2: Rate Limiting
```
In supabase/functions/tenant-signup/index.ts, verify:
- checkRateLimit imported from _shared/rateLimiting.ts
- Rate limit checked BEFORE database operations
- Uses IP+email as key, returns 429 with retryAfter
- Gracefully degrades if Redis unavailable
```

### Question 3: CAPTCHA
```
Verify CAPTCHA in both files:
- supabase/functions/tenant-signup/index.ts: captchaToken in schema, verified with Turnstile API
- src/pages/saas/SignUpPage.tsx: Turnstile component rendered, resets on error
- Environment vars: VITE_TURNSTILE_SITE_KEY (frontend), TURNSTILE_SECRET_KEY (backend)
```

---

## ⚡ Performance Checks

### Question 4: No Page Reload
```
In src/pages/saas/SignUpPage.tsx, verify:
- Uses navigate() from react-router-dom (NOT window.location.href)
- Navigation includes state: { fromSignup: true, showWelcome: true }
- src/hooks/usePrefetchDashboard.ts exists and prefetches before navigation
```

### Question 5: Atomic Database
```
Verify atomic function:
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql exists
- Creates create_tenant_atomic function (single transaction for tenant+user+event)
- supabase/functions/tenant-signup/index.ts uses supabase.rpc('create_tenant_atomic')
- Rollback handled if function fails
```

### Question 6: Background Tasks
```
In supabase/functions/tenant-signup/index.ts, verify:
- Background tasks use Promise.allSettled (NOT awaited)
- Includes: email verification, welcome email, analytics
- Errors don't fail signup response
- Tasks run after response is sent
```

### Question 7: Skeleton Loading
```
Verify skeleton components:
- src/components/loading/SkeletonAdminLayout.tsx exists
- src/components/loading/SkeletonDashboard.tsx exists
- src/App.tsx uses them as Suspense fallbacks
- Dashboard route has <Suspense fallback={<SkeletonDashboard />}>
```

### Question 8: Route Prefetching
```
Verify prefetching:
- src/hooks/useRoutePrefetch.ts exists (prefetches on hover, 100ms debounce)
- src/components/tenant-admin/TenantAdminSidebar.tsx: NavLink has onMouseEnter/onFocus
- Calls prefetchRoute() before user clicks
```

---

## 🎨 UX Checks

### Question 9: Email Verification
```
Verify email verification:
- supabase/migrations/20251111183615_add_email_verification.sql: adds email_verified, email_verification_sent_at, email_verification_token_expires_at columns
- Atomic function sets email_verified: false, expires_at: NOW() + 7 days
- tenant-signup: email_confirm: false, generates link, sends email in background
```

### Question 10: Welcome Modal
```
Verify welcome modal:
- src/components/onboarding/WelcomeModal.tsx exists (Get Started, Take Tour, Skip buttons)
- src/pages/tenant-admin/DashboardPage.tsx: imports WelcomeModal, checks location.state for fromSignup/showWelcome
- 'Take Tour' calls startTutorial('dashboard-tour', true)
- Uses sessionStorage to remember if seen
```

---

## 🔧 Integration Checks

### Question 11: Auth Context
```
Verify TenantAdminAuthContext:
- Has isAuthenticated state (boolean)
- Has handleSignupSuccess method (sets state, stores user/tenant data, NOT tokens)
- Initialization uses credentials:'include' in fetch
- verifyToken checks cookies first, falls back to Authorization header
```

### Question 12: Database Migrations
```
Verify migrations exist and are ready:
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql
- supabase/migrations/20251111183615_add_email_verification.sql
- Both are idempotent (can run multiple times)
- Proper PostgreSQL syntax
```

---

## 🧪 End-to-End Flow

### Question 13: Complete Signup Flow
```
Trace the complete signup flow:
1. User fills form → CAPTCHA appears → Form validates
2. Submit → Rate limit checked → CAPTCHA verified → httpOnly cookies set → Background tasks start
3. Navigate (React Router, no reload) → Dashboard prefetches → Welcome modal appears → User authenticated
Verify each step works correctly.
```

### Question 14: Error Handling
```
Verify error handling:
- Rate limit: 429 with retryAfter
- CAPTCHA failure: 400, resets CAPTCHA
- DB errors: Rollback (deletes auth user), user-friendly messages
- Network errors: Caught, form state preserved
All errors logged with logger, not console.log
```

---

## 📋 Final Comprehensive Check

### Question 15: Everything Together
```
Perform complete integration check:
1. List all 10 created files - verify they exist
2. List all 7 modified files - verify changes are correct
3. Check all imports are correct (no broken references)
4. Verify features work together:
   - Signup → Cookies → Navigation → Dashboard → Welcome Modal
   - Rate limit → CAPTCHA → Atomic DB → Background tasks
   - Prefetch → Skeleton → Dashboard load
5. Check TypeScript: no errors, proper types
6. Check linting: no console.log, uses logger
7. Verify environment variables documented
8. Check backwards compatibility maintained
Provide a comprehensive integration report with any issues found.
```

---

## 🎯 Quick Verification Script

**Copy this entire block and paste to Lovable:**

```
I need you to verify that signup and authentication improvements are properly integrated. Please check:

SECURITY:
1. httpOnly cookies: Check tenant-signup/index.ts sets cookies (not in body), tenant-admin-auth/index.ts checks cookies first, TenantAdminAuthContext uses credentials:'include', SignUpPage doesn't store tokens in localStorage
2. Rate limiting: Check tenant-signup uses checkRateLimit before DB ops, returns 429, graceful degradation
3. CAPTCHA: Check Turnstile component in SignUpPage, verification in tenant-signup, env vars configured

PERFORMANCE:
4. Navigation: Check SignUpPage uses navigate() not window.location.href, includes state, prefetches dashboard
5. Atomic DB: Check migration creates create_tenant_atomic function, tenant-signup uses RPC call
6. Background tasks: Check Promise.allSettled (not awaited), includes email/analytics, errors don't fail signup
7. Skeleton loading: Check SkeletonAdminLayout and SkeletonDashboard exist, used in App.tsx Suspense
8. Route prefetch: Check useRoutePrefetch hook, sidebar NavLink has onMouseEnter/onFocus

UX:
9. Email verification: Check migration adds columns, atomic function sets email_verified:false, tenant-signup generates link
10. Welcome modal: Check WelcomeModal component, DashboardPage integration, tutorial integration

INTEGRATION:
11. Auth context: Check isAuthenticated state, handleSignupSuccess method, cookie verification
12. Migrations: Check both migrations exist, are idempotent, ready to run

Please verify each point and report any issues or missing implementations.
```

---

## 📊 Expected File Count

**Created Files (10):**
- src/hooks/usePrefetchDashboard.ts
- src/hooks/useRoutePrefetch.ts
- src/components/loading/SkeletonAdminLayout.tsx
- src/components/loading/SkeletonDashboard.tsx
- src/components/onboarding/WelcomeModal.tsx
- supabase/migrations/20251111183614_create_tenant_atomic_function.sql
- supabase/migrations/20251111183615_add_email_verification.sql
- Documentation files (3+)

**Modified Files (7):**
- supabase/functions/tenant-signup/index.ts
- supabase/functions/tenant-admin-auth/index.ts
- src/pages/saas/SignUpPage.tsx
- src/contexts/TenantAdminAuthContext.tsx
- src/components/tenant-admin/TenantAdminSidebar.tsx
- src/pages/tenant-admin/DashboardPage.tsx
- src/App.tsx

---

**Use these questions systematically to verify everything is integrated correctly!**

