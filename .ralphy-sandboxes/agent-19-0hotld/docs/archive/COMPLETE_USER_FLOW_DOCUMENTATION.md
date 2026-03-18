# Complete User Flow: Main Page → Signup → Admin Panel

## 📋 Table of Contents
1. [Landing on Main Page](#1-landing-on-main-page)
2. [Navigating to Signup](#2-navigating-to-signup)
3. [Signup Process](#3-signup-process)
4. [Post-Signup Authentication](#4-post-signup-authentication)
5. [Accessing Admin Panel](#5-accessing-admin-panel)
6. [Dashboard Experience](#6-dashboard-experience)

---

## 1. Landing on Main Page

### URL: `/` (Root Route)

### Component: `SmartRootRedirect` (`src/components/SmartRootRedirect.tsx`)

### Flow Details:

1. **Initial Load**
   - Component mounts and sets `checking = true`
   - Shows `<LoadingFallback />` spinner

2. **Authentication Check**
   - Calls `getCurrentUserType()` to check localStorage for:
     - `tenant_admin_access_token`
     - `tenant_admin_user`
     - `tenant_data`
     - `super_admin_token`
     - `customer_token`

3. **Redirect Logic** (Line 17-84):
   ```typescript
   if (!userType) {
     // Not authenticated → Marketing page
     setRedirectPath("/marketing");
   }
   ```

4. **Result for New User**
   - **Redirects to**: `/marketing`
   - **Component**: `MarketingHome` (`src/pages/MarketingHome.tsx`)

### Marketing Page Features:
- Hero section with CTA buttons
- Features showcase
- Pricing information
- "Get Started" / "Sign Up" buttons
- Links to `/signup` route

---

## 2. Navigating to Signup

### User Action:
- Clicks "Sign Up" button on marketing page
- Or navigates directly to `/signup`

### Route Definition:
```typescript
<Route path="/signup" element={<SignUpPage />} />
```

### Component: `SignUpPage` (`src/pages/saas/SignUpPage.tsx`)

### Page Structure:
- **Multi-step form** with 3 steps:
  1. **Step 0: Account** (Required)
     - Business name
     - Owner name
     - Email
     - Password (with strength indicator)
  2. **Step 1: Business** (Optional)
     - Phone
     - State
     - Industry
     - Company size
  3. **Step 2: Review** (Final)
     - Review all entered information
     - Terms of Service checkbox (required)
     - Submit button

### Form Features:
- **Auto-save**: Form data saved to `localStorage` key `'signup_form_data'` (line 118-127)
- **Validation**: Uses React Hook Form + Zod schema
- **Step validation**: Each step validates before proceeding
- **Password strength**: Real-time password strength indicator

---

## 3. Signup Process

### Step-by-Step Flow:

#### 3.1 User Completes Form
- Fills in all required fields (Step 0)
- Optionally fills business details (Step 1)
- Reviews and accepts terms (Step 2)
- Clicks "Create Account" button

#### 3.2 Form Submission (`onSubmit` function - Line 173-252)

**Process:**
1. **Clear saved form data** (line 177)
   ```typescript
   localStorage.removeItem(STORAGE_KEY);
   ```

2. **Call Tenant Signup Edge Function** (line 180-191)
   ```typescript
   const { data: result, error } = await supabase.functions.invoke('tenant-signup', {
     body: {
       email: data.email,
       password: data.password,
       business_name: data.business_name,
       owner_name: data.owner_name,
       phone: data.phone,
       state: data.state,
       industry: data.industry,
       company_size: data.company_size,
     },
   });
   ```

#### 3.3 Edge Function Processing (`supabase/functions/tenant-signup/index.ts`)

**Step-by-Step Backend Processing:**

1. **Request Validation** (line 68-70)
   - Validates request body with Zod schema
   - Ensures all required fields present
   - Validates email format, password length, etc.

2. **Email Conflict Checks** (line 72-116)
   - **Check 1**: Supabase Auth users (line 73-84)
     - Queries all auth users
     - Returns error if email exists
   - **Check 2**: `tenant_users` table (line 88-98)
     - Returns error if email already registered as staff
   - **Check 3**: `customer_users` table (line 102-115) ⭐ **NEW**
     - Cross-table validation
     - Returns error: "This email is registered as a customer account"

3. **Slug Generation** (line 118-150)
   - **Initial**: `generateSlug(business_name)` → lowercase, hyphens
   - **Uniqueness Check**: Queries `tenants` table (line 123-133)
   - **Retry Logic**: Up to 10 attempts with timestamp suffix
   - **UUID Fallback** ⭐ **NEW** (line 136-150):
     ```typescript
     if (slugExists) {
       const uuidSuffix = crypto.randomUUID().split('-')[0];
       slug = `${baseSlug}-${uuidSuffix}`;
       // Always succeeds - no 500 errors
     }
     ```

4. **Create Supabase Auth User** (line 153-169)
   ```typescript
   await supabase.auth.admin.createUser({
     email: email.toLowerCase(),
     password: password,
     email_confirm: true, // Auto-confirmed (no email verification required)
     user_metadata: {
       name: owner_name,
       business_name: business_name,
     },
   });
   ```

5. **Create Tenant Record** (line 176-214)
   ```typescript
   await supabase.from('tenants').insert({
     business_name,
     slug, // Generated unique slug
     owner_email: email.toLowerCase(),
     owner_name,
     phone: phone || null,
     state: state || null,
     industry: industry || null,
     company_size: company_size || null,
     subscription_plan: 'starter', // Default plan
     subscription_status: 'trial', // Starts in trial
     trial_ends_at: new Date() + 14 days, // 14-day trial
     limits: {
       customers: 50,
       menus: 3,
       products: 100,
       locations: 2,
       users: 3, // ⭐ User limit enforced
     },
     usage: {
       customers: 0,
       menus: 0,
       products: 0,
       locations: 0,
       users: 1, // Owner counts as 1 user
     },
     features: {
       api_access: false,
       custom_branding: false,
       white_label: false,
       advanced_analytics: false,
       sms_enabled: false,
     },
   });
   ```

6. **Create Tenant User (Owner)** (line 229-254)
   ```typescript
   await supabase.from('tenant_users').insert({
     tenant_id: tenant.id,
     user_id: authData.user.id, // Links to Supabase Auth user
     email: email.toLowerCase(),
     name: owner_name,
     role: 'owner', // ⭐ Owner role gets all permissions
     status: 'active',
     invited_at: new Date().toISOString(),
     accepted_at: new Date().toISOString(),
   });
   ```

7. **Create Subscription Event** (line 257-262)
   - Logs `trial_started` event in `subscription_events` table

8. **Generate JWT Tokens** (line 264-288)
   ```typescript
   const accessToken = encodeJWT({
     user_id: tenantUser.id,
     email: tenantUser.email,
     name: tenantUser.name,
     role: tenantUser.role,
     tenant_id: tenant.id,
     tenant_slug: tenant.slug,
   }, jwtSecret, 7 * 24 * 60 * 60); // 7 days

   const refreshToken = encodeJWT({
     user_id: tenantUser.id,
     tenant_id: tenant.id,
     type: 'refresh',
   }, jwtSecret, 30 * 24 * 60 * 60); // 30 days
   ```

9. **Return Success Response** (line 291-318)
   ```typescript
   return {
     success: true,
     tenant: {
       id, business_name, slug, owner_email,
       subscription_plan, subscription_status,
       limits, usage, features
     },
     user: {
       id, email, name, role, tenant_id
     },
     tokens: {
       access_token, refresh_token
     }
   };
   ```

#### 3.4 Frontend Post-Signup (Back to `SignUpPage.tsx`)

**After Edge Function Returns Success:**

1. **Store Tokens in localStorage** (line 210-214)
   ```typescript
   localStorage.setItem('tenant_admin_access_token', result.tokens.access_token);
   localStorage.setItem('tenant_admin_refresh_token', result.tokens.refresh_token);
   localStorage.setItem('tenant_admin_user', JSON.stringify(result.user));
   localStorage.setItem('tenant_data', JSON.stringify(result.tenant));
   ```

2. **Show Success Toast** (line 217-220)
   ```typescript
   toast({
     title: 'Account Created!',
     description: 'Welcome to your new dashboard! Redirecting...',
   });
   ```

3. **Force Page Reload & Redirect** (line 222-226)
   ```typescript
   setTimeout(() => {
     window.location.href = `/${tenant.slug}/admin/dashboard`;
   }, 100);
   ```
   - **Why `window.location.href`?** Forces full page reload to re-initialize all React contexts with new tokens
   - **Why 100ms delay?** Ensures localStorage writes complete before navigation

---

## 4. Post-Signup Authentication

### URL After Redirect: `/{tenantSlug}/admin/dashboard`

### Route Definition:
```typescript
<Route 
  path="/:tenantSlug/admin/*" 
  element={<TenantAdminProtectedRoute><AdminLayout /></TenantAdminProtectedRoute>}
>
  <Route path="dashboard" element={<TenantAdminDashboardPage />} />
</Route>
```

### Authentication Flow:

#### 4.1 Page Loads → `TenantAdminProtectedRoute` Component

**Component**: `src/components/auth/TenantAdminProtectedRoute.tsx`

**Initial State:**
- `verifying = false` (line 27)
- `verified = false` (line 28)
- `skipVerification = false` (line 30)

#### 4.2 `TenantAdminAuthContext` Initialization

**Component**: `src/contexts/TenantAdminAuthContext.tsx`

**Process** (Line 138-250):

1. **Load from localStorage** (line 142-145)
   ```typescript
   const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
   const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
   const storedAdmin = localStorage.getItem(ADMIN_KEY);
   const storedTenant = localStorage.getItem(TENANT_KEY);
   ```

2. **Extract Tenant Slug from URL** (line 148-149)
   ```typescript
   const currentPath = window.location.pathname;
   const urlTenantSlug = currentPath.split('/')[1]; // e.g., "acme-corp"
   ```

3. **Validate Tenant Slug Match** (line 183-192)
   ```typescript
   if (urlTenantSlug && parsedTenant.slug !== urlTenantSlug) {
     // Tenant mismatch - clear auth and stop loading
     localStorage.removeItem(ACCESS_TOKEN_KEY);
     // ... clear all auth data
     setLoading(false);
     return;
   }
   ```

4. **Set Initial State** (line 194-220)
   - Parses tenant data with defaults for `limits` and `usage`
   - Sets `admin`, `tenant`, `accessToken`, `refreshToken` state
   - Sets `loading = false`

5. **Token Verification** (if token exists - line 222-250)
   - Calls `verifyToken()` function
   - Verifies with edge function: `tenant-admin-auth?action=verify`

#### 4.3 Token Verification Process

**Function**: `verifyToken()` (line 251-450)

**Steps:**

1. **Check Token Expiration** (line 264-275)
   - If token expires within 60 seconds → attempts refresh first

2. **Call Verification Endpoint** (line 288-295)
   ```typescript
   await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
     method: "GET",
     headers: {
       "Authorization": `Bearer ${tokenToVerify}`,
     },
   });
   ```

3. **Edge Function Verification** (`supabase/functions/tenant-admin-auth/index.ts`)

   **Verify Action** (line 500-600):
   - Extracts token from Authorization header
   - Calls `supabase.auth.getUser(token)`
   - Checks if user is tenant owner (line 540-560):
     ```typescript
     const { data: ownedTenant } = await supabase
       .from('tenants')
       .select('*')
       .eq('owner_email', userEmail)
       .maybeSingle();
     ```
   - Or checks `tenant_users` table (line 570-590):
     ```typescript
     const { data: tenantUser } = await supabase
       .from('tenant_users')
       .select('*, tenants(*)')
       .eq('user_id', user.id)
       .eq('email', userEmail)
       .eq('status', 'active')
       .maybeSingle();
     ```
   - Returns `{ verified: true, admin: {...}, tenant: {...} }`

4. **Update Context State** (line 391-450)
   - Sets `admin` and `tenant` from verification response
   - Sets `loading = false`
   - Sets up proactive token refresh timer

#### 4.4 Route Protection Verification

**Back to `TenantAdminProtectedRoute`:**

1. **Wait for Auth Context** (line 95-110)
   - If `loading = true` → shows `<LoadingFallback />`
   - Waits up to 10 seconds for auth to load

2. **Check Authentication** (line 113-118)
   ```typescript
   if (!admin || !tenant) {
     return <Navigate to={`/${tenantSlug}/admin/login`} replace />;
   }
   ```

3. **Local Slug Verification** (line 154-165)
   ```typescript
   const isValidSlug = tenant.slug === tenantSlug;
   
   if (!isValidSlug) {
     setVerificationError("Tenant mismatch. Please re-login.");
     return; // Shows error UI
   }
   ```
   - **No server call needed** - just compares stored tenant slug with URL

4. **Cache Verification Result** (line 170-173)
   ```typescript
   verificationCache.current[cacheKey] = {
     verified: true,
     timestamp: Date.now(),
   };
   ```
   - Caches for 2 minutes to avoid repeated checks

5. **Set Verified State** (line 175-178)
   ```typescript
   setVerified(true);
   setVerifying(false);
   setVerificationError(null);
   ```

6. **Render Protected Content** (line 237-241)
   ```typescript
   return (
     <VerificationProvider>
       {children} // AdminLayout component
     </VerificationProvider>
   );
   ```

---

## 5. Accessing Admin Panel

### Route Structure:
```
/:tenantSlug/admin/*
  ├── dashboard (TenantAdminDashboardPage)
  ├── disposable-menus
  ├── inventory-dashboard
  ├── wholesale-orders
  ├── big-plug-clients
  ├── staff-management
  └── ... (100+ routes)
```

### Component: `AdminLayout` (`src/pages/admin/AdminLayout.tsx`)

**Layout Structure:**

1. **Sidebar** (`TenantAdminSidebar`)
   - Navigation menu
   - Feature-gated menu items
   - Role-based menu visibility

2. **Header** (Line 99-150)
   - Account switcher
   - Search bar
   - Notifications
   - Theme toggle
   - Keyboard shortcuts

3. **Main Content Area** (`<Outlet />`)
   - Renders child route components
   - Breadcrumb navigation
   - Page-specific content

4. **Mobile Navigation** (`MobileBottomNav`)
   - Bottom navigation for mobile devices

### First Page: Dashboard

**Route**: `/:tenantSlug/admin/dashboard`

**Component**: `TenantAdminDashboardPage` (`src/pages/tenant-admin/DashboardPage.tsx`)

**Dashboard Features:**
- **Metrics Cards**: Orders, Revenue, Products, Customers
- **Usage Limits**: Progress bars showing usage vs limits
- **Quick Actions**: Create product, Add customer, Create menu
- **Recent Activity**: Latest orders, menu views
- **Trial Status**: Days remaining in trial
- **Upgrade Prompts**: If limits reached

---

## 6. Dashboard Experience

### Initial Load Sequence:

1. **Auth Context Loads** (0-2 seconds)
   - Reads tokens from localStorage
   - Verifies token with edge function
   - Loads tenant and admin data

2. **Route Protection** (0-1 second)
   - `TenantAdminProtectedRoute` verifies slug match
   - Caches verification result

3. **AdminLayout Renders** (0-1 second)
   - Sidebar loads navigation
   - Header loads account info
   - Main content area ready

4. **Dashboard Page Loads** (0-2 seconds)
   - Fetches metrics from database
   - Loads usage data
   - Renders dashboard widgets

**Total Time**: ~3-6 seconds for first load

### Subsequent Navigation:

- **Cached Verification**: 2-minute cache prevents re-verification
- **Instant Navigation**: React Router handles route changes
- **No Full Reload**: SPA navigation (no page refresh)

---

## 🔐 Security Checkpoints

### 1. Email Validation
- ✅ Checks Supabase Auth users
- ✅ Checks `tenant_users` table
- ✅ Checks `customer_users` table (cross-table validation)

### 2. Slug Uniqueness
- ✅ Database query for existing slugs
- ✅ Retry with timestamp suffix (10 attempts)
- ✅ UUID fallback ensures always succeeds

### 3. Token Verification
- ✅ JWT token validated on every protected route
- ✅ Tenant slug must match URL
- ✅ Token expiration checked (7 days access, 30 days refresh)
- ✅ Proactive refresh 5 minutes before expiration

### 4. Route Protection
- ✅ `TenantAdminProtectedRoute` wraps all admin routes
- ✅ Verifies tenant slug matches URL
- ✅ Redirects to login if not authenticated
- ✅ Shows error if tenant mismatch

### 5. Permission System ⭐ **NEW**
- ✅ Role-based permissions (owner, admin, team_member, viewer)
- ✅ Permission checks in edge functions
- ✅ `PermissionGuard` component for UI-level checks

---

## 📊 Data Flow Diagram

```
User Action → Frontend → Edge Function → Database → Response → Frontend → UI
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     ▼           ▼             ▼            ▼          ▼          ▼        ▼
  Click      SignUpPage   tenant-signup   tenants   Success   Store    Redirect
  Signup     Component    Edge Function   table     Response  Tokens   Dashboard
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     └───────────┴─────────────┴────────────┴──────────┴──────────┴────────┘
```

---

## 🎯 Key URLs in Flow

1. **Landing**: `/` → Redirects to `/marketing`
2. **Marketing**: `/marketing` → Shows features, pricing
3. **Signup**: `/signup` → Multi-step signup form
4. **Post-Signup**: `/{slug}/admin/dashboard` → Dashboard (after redirect)
5. **Login**: `/{slug}/admin/login` → Login page (if not auto-logged in)
6. **Welcome**: `/{slug}/admin/welcome` → Optional welcome/onboarding page

---

## ⚠️ Error Scenarios & Handling

### Scenario 1: Email Already Exists
- **Error**: "An account with this email already exists"
- **Action**: User redirected to login page
- **Message**: "Please sign in instead"

### Scenario 2: Business Name Taken
- **Error**: Slug generation finds duplicate
- **Action**: Auto-generates unique slug with timestamp or UUID
- **Result**: Signup succeeds with modified slug

### Scenario 3: Network Error
- **Error**: Edge function call fails
- **Action**: Shows error toast
- **Message**: "Network error. Please check your connection"

### Scenario 4: Token Expired
- **Error**: Token verification fails
- **Action**: Attempts refresh token
- **Fallback**: Redirects to login if refresh fails

### Scenario 5: Tenant Mismatch
- **Error**: URL slug doesn't match authenticated tenant
- **Action**: Clears auth state, redirects to correct tenant login
- **Message**: "Tenant mismatch. Please re-login."

---

## 🔄 Auto-Login After Signup

### Why It Works:

1. **Tokens Stored**: Access + refresh tokens saved to localStorage
2. **Full Page Reload**: `window.location.href` forces context re-initialization
3. **Auth Context**: Reads tokens on mount and verifies
4. **Seamless**: User never sees login page after signup

### If Auto-Login Fails:

- User redirected to `/{slug}/admin/login`
- Can manually log in with email/password
- Tokens still valid (7 days), so login succeeds immediately

---

## 📝 Summary: Complete Flow

1. **User visits** `/` → Redirected to `/marketing`
2. **Clicks "Sign Up"** → Navigates to `/signup`
3. **Fills form** (3 steps) → Validates and submits
4. **Edge function** processes:
   - Validates email (3 checks)
   - Generates unique slug (with UUID fallback)
   - Creates auth user, tenant, tenant_user
   - Generates JWT tokens
5. **Frontend** stores tokens → Redirects to `/{slug}/admin/dashboard`
6. **Page reloads** → `TenantAdminAuthContext` initializes
7. **Token verification** → Edge function verifies access
8. **Route protection** → `TenantAdminProtectedRoute` validates
9. **Dashboard renders** → User sees admin panel

**Total Time**: ~5-10 seconds from signup click to dashboard view

---

## 🎨 User Experience Highlights

- ✅ **No email verification required** (auto-confirmed)
- ✅ **Instant access** after signup (auto-login)
- ✅ **Form auto-save** (prevents data loss)
- ✅ **Password strength indicator** (real-time feedback)
- ✅ **Multi-step wizard** (reduces form fatigue)
- ✅ **Clear error messages** (actionable guidance)
- ✅ **Seamless redirect** (no manual login needed)
- ✅ **Fast dashboard load** (cached verification)

---

**This flow ensures a smooth, secure, and user-friendly experience from first visit to productive use of the admin panel.**

