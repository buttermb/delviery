# Complete Customer Flow: Signup → Verification → Login → Portal → Shopping

## 📋 Table of Contents
1. [Customer Signup Flow](#1-customer-signup-flow)
2. [Email Verification Process](#2-email-verification-process)
3. [Customer Login Flow](#3-customer-login-flow)
4. [Customer Portal Access](#4-customer-portal-access)
5. [Shopping Experience](#5-shopping-experience)
6. [Order Management](#6-order-management)
7. [Account Settings](#7-account-settings)
8. [Security & Authentication](#8-security--authentication)

---

## 1. Customer Signup Flow

### URL: `/{tenantSlug}/customer/signup`

### Component: `CustomerSignUpPage` (`src/pages/customer/SignUpPage.tsx`)

### Flow Details:

#### 1.1 Initial Page Load

1. **Tenant Validation** (Line 35-54)
   - Fetches tenant by slug from `tenants` table
   - Validates tenant exists and is active
   - Shows loading spinner while fetching
   - If tenant not found → Shows "Store Not Found" error page

2. **Page Rendering**
   - Displays tenant logo (if white-label configured)
   - Shows business name
   - Renders signup form with tenant-specific styling

#### 1.2 Signup Form Fields

**Required Fields:**
- **First Name** (text input)
- **Last Name** (text input)
- **Email** (email input, validated)
- **Phone Number** (tel input, validated)
- **Password** (password input, min 8 characters)
  - Real-time password strength indicator
- **Confirm Password** (password input, must match)

**Conditional Fields:**
- **Date of Birth** (date input)
  - Required if `tenant.age_verification_required === true`
  - Validates minimum age (default: 21, configurable per tenant)
  - Max date set to prevent future dates

#### 1.3 Form Submission (`handleSubmit` - Line 56-128)

**Client-Side Validation:**
```typescript
1. Check tenantSlug exists
2. Validate passwords match
3. Validate password length (min 8 characters)
```

**Edge Function Call:**
```typescript
POST /functions/v1/customer-auth?action=signup
Body: {
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone: string | null,
  dateOfBirth: string | null,
  tenantSlug: string
}
```

#### 1.4 Backend Processing (`supabase/functions/customer-auth/index.ts`)

**Step-by-Step Backend Flow:**

1. **Request Validation** (Line 89-100)
   - Validates request body with Zod schema
   - Ensures all required fields present
   - Validates email format, password length, etc.

2. **Tenant Lookup** (Line 107-119)
   ```typescript
   const { data: tenant } = await supabase
     .from("tenants")
     .select("*")
     .eq("slug", tenantSlug.toLowerCase())
     .eq("status", "active")
     .maybeSingle();
   ```
   - Returns 404 if tenant not found or inactive

3. **Email Conflict Checks** (Line 122-157) ⭐ **CRITICAL**
   
   **Check 1: Existing Customer** (Line 122-134)
   ```typescript
   const { data: existingUser } = await supabase
     .from("customer_users")
     .select("id")
     .eq("email", email.toLowerCase())
     .eq("tenant_id", tenant.id)
     .maybeSingle();
   ```
   - Returns 409 if email already registered as customer

   **Check 2: Staff Account** (Line 136-157) ⭐ **NEW**
   ```typescript
   const { data: tenantUserExists } = await serviceClient
     .from('tenant_users')
     .select('id, role')
     .eq('email', email.toLowerCase())
     .eq('tenant_id', tenant.id)
     .maybeSingle();
   ```
   - Returns 409 if email registered as staff
   - Error message: "This email is registered as a staff account. Please use the staff login at /{slug}/admin/login instead."

4. **Age Verification** (Line 162-182)
   ```typescript
   if (dateOfBirth) {
     const birthDate = new Date(dateOfBirth);
     const today = new Date();
     const age = calculateAge(birthDate, today);
     const minimumAge = tenant.minimum_age || 21;
     
     if (age < minimumAge) {
       return 403: "You must be at least {minimumAge} years old"
     }
   } else if (tenant.age_verification_required) {
     return 400: "Date of birth is required for age verification"
   }
   ```

5. **Phone Validation** (Line 184-209)
   - Optional: Calls `validate-phone` edge function
   - Validates phone number format
   - Doesn't block signup if validation service is down

6. **Password Hashing** (Line 160)
   ```typescript
   const passwordHash = await hashPassword(password);
   // Uses bcrypt for secure password hashing
   ```

7. **Create Customer User** (Line 212-235)
   ```typescript
   await supabase.from("customer_users").insert({
     email: email.toLowerCase(),
     password_hash: passwordHash,
     first_name: firstName || null,
     last_name: lastName || null,
     phone: phone || null,
     date_of_birth: dateOfBirth || null,
     tenant_id: tenant.id,
     status: 'active',
     email_verified: false, // ⭐ REQUIRES VERIFICATION
     minimum_age_required: tenant.minimum_age || 21,
   });
   ```

8. **Send Verification Email** (Line 237-253)
   ```typescript
   fetch(`${supabaseUrl}/functions/v1/send-verification-email`, {
     method: 'POST',
     body: JSON.stringify({
       customer_user_id: customerUser.id,
       tenant_id: tenant.id,
       email: email.toLowerCase(),
       tenant_name: tenant.business_name,
     }),
   });
   ```
   - **Non-blocking**: Signup succeeds even if email fails
   - Sends 6-digit verification code via email

9. **Return Success Response** (Line 257-265)
   ```typescript
   return {
     success: true,
     message: "Account created successfully. Please check your email to verify your account.",
     requires_verification: true,
     customer_user_id: customerUser.id,
   };
   ```

#### 1.5 Frontend Post-Signup

**After Edge Function Returns Success:**

1. **Show Success Toast** (Line 111-114)
   ```typescript
   toast({
     title: "Account created!",
     description: "Please check your email to verify your account",
   });
   ```

2. **Redirect to Verification Page** (Line 117)
   ```typescript
   navigate(`/${tenantSlug}/customer/verify-email?email=${encodeURIComponent(formData.email)}`);
   ```

**Error Handling:**
- Network errors → Shows error toast
- Email already exists → Shows specific error message
- Age verification failed → Shows age requirement message
- Staff account conflict → Shows redirect to admin login

---

## 2. Email Verification Process

### URL: `/{tenantSlug}/customer/verify-email?email={email}`

### Component: `CustomerVerifyEmailPage` (`src/pages/customer/VerifyEmailPage.tsx`)

### Flow Details:

#### 2.1 Page Load

1. **Extract Email from URL** (Line 23)
   ```typescript
   const emailFromUrl = searchParams.get('email');
   setEmail(emailFromUrl || '');
   ```

2. **Fetch Tenant** (Line 33-52)
   - Loads tenant data for branding
   - Shows loading spinner while fetching

3. **Pre-fill Code** (Line 22-25)
   - If `?code=123456` in URL, pre-fills verification code
   - Useful for email links with embedded code

#### 2.2 Verification Form

**Fields:**
- **Email** (pre-filled, can be edited)
- **Verification Code** (6-digit input)
  - Auto-formats to 6 digits
  - Large, centered, monospace font
  - Auto-focus on load

#### 2.3 Verification Process (`handleVerify` - Line 54-157)

**Step 1: Client Validation** (Line 57-73)
```typescript
if (!code || code.length !== 6) {
  toast({ error: "Please enter the 6-digit verification code" });
  return;
}
```

**Step 2: Call Verification Endpoint** (Line 78-87)
```typescript
POST /functions/v1/verify-email-code
Body: {
  code: string (6 digits),
  email: string,
  tenant_slug: string
}
```

**Step 3: Backend Verification** (`verify-email-code` edge function)
- Validates code matches stored verification code
- Checks code hasn't expired (typically 15 minutes)
- Updates `customer_users.email_verified = true`
- Returns success or error

**Step 4: Auto-Login After Verification** (Line 112-146)
```typescript
// Get customer user to find tenant
const { data: customerUser } = await supabase
  .from('customer_users')
  .select('tenant_id')
  .eq('email', email.toLowerCase())
  .maybeSingle();

// Redirect to login with verified=true flag
navigate(`/${tenantSlug}/customer/login?verified=true&email=${encodeURIComponent(email)}`);
```

#### 2.4 Resend Verification Code (`handleResend` - Line 159-222)

**Process:**
1. Validates email is provided
2. Finds customer user by email
3. Calls `send-verification-email` edge function
4. Generates new 6-digit code
5. Sends email with new code
6. Shows success toast

**Rate Limiting:**
- Typically limited to 3 resends per hour
- Prevents email spam

#### 2.5 Success State

**After Verification:**
- Shows success screen with checkmark
- Auto-redirects to login page after 2 seconds
- Login page pre-fills email and shows "Email Verified!" message

---

## 3. Customer Login Flow

### URL: `/{tenantSlug}/customer/login` or `/{tenantSlug}/shop/login`

### Component: `CustomerLoginPage` (`src/pages/customer/LoginPage.tsx`)

### Flow Details:

#### 3.1 Page Load

1. **Check for Verification Success** (Line 27-42)
   ```typescript
   const verified = urlParams.get('verified');
   const emailParam = urlParams.get('email');
   
   if (verified === 'true' && emailParam) {
     setEmail(emailParam);
     toast({
       title: 'Email Verified!',
       description: 'Please enter your password to complete login.',
     });
   }
   ```

2. **Fetch Tenant** (Line 44-63)
   - Loads tenant data for branding
   - Validates tenant exists and is active

3. **Auth Redirect Check** (Line 19)
   ```typescript
   useAuthRedirect(); // Redirects if already logged in
   ```
   - If customer already authenticated → Redirects to dashboard

#### 3.2 Login Form

**Fields:**
- **Email** (pre-filled if from verification)
- **Password**

**Links:**
- "Forgot Password" → Opens password reset dialog
- "Create account" → Links to signup page
- "Business owner? Admin Login" → Links to `/{slug}/admin/login`

#### 3.3 Login Process (`handleSubmit` - Line 65-110)

**Step 1: Client Validation** (Line 68-75)
```typescript
if (!tenantSlug) {
  toast({ error: "Tenant slug is required" });
  return;
}
```

**Step 2: Call Login Function** (Line 80)
```typescript
await login(email, password, tenantSlug);
```

**Step 3: CustomerAuthContext Login** (`src/contexts/CustomerAuthContext.tsx` - Line 156-195)

**Process:**
1. **Call Edge Function** (Line 164-170)
   ```typescript
   POST /functions/v1/customer-auth?action=login
   Body: {
     email: string,
     password: string,
     tenantSlug: string
   }
   ```

2. **Backend Login Processing** (`customer-auth` edge function - Line 268-391)

   **a. Request Validation** (Line 270-279)
   - Validates with Zod schema

   **b. Find Tenant** (Line 284-296)
   - Validates tenant exists and is active

   **c. Find Customer User** (Line 299-312)
   ```typescript
   const { data: customerUser } = await supabase
     .from("customer_users")
     .select("*")
     .eq("email", email.toLowerCase())
     .eq("tenant_id", tenant.id)
     .eq("status", "active")
     .maybeSingle();
   ```
   - Returns 401 if not found

   **d. Verify Password** (Line 315-321)
   ```typescript
   const validPassword = await comparePassword(password, customerUser.password_hash);
   ```
   - Uses bcrypt comparison
   - Returns 401 if invalid

   **e. Check Email Verification** (Line 323-334) ⭐ **CRITICAL**
   ```typescript
   if (!customerUser.email_verified) {
     return {
       error: "Email not verified",
       requires_verification: true,
       customer_user_id: customerUser.id,
       message: "Please verify your email address before logging in."
     };
   }
   ```
   - Returns 403 if email not verified
   - Redirects to verification page

   **f. Get Linked Customer Record** (Line 337-345)
   - If `customer_user.customer_id` exists, fetches from `customers` table
   - Used for legacy customer data

   **g. Generate JWT Token** (Line 348-353)
   ```typescript
   const token = encodeJWT({
     customer_user_id: customerUser.id,
     customer_id: customerUser.customer_id || customerUser.id,
     tenant_id: tenant.id,
     type: "customer",
   });
   ```
   - Token expires in 30 days
   - Includes customer and tenant IDs

   **h. Create Session Record** (Line 356-369)
   ```typescript
   await supabase.from("customer_sessions").insert({
     customer_user_id: customerUser.id,
     tenant_id: tenant.id,
     token,
     ip_address: clientIp,
     user_agent: userAgent,
     expires_at: expiresAt, // 30 days from now
   });
   ```

   **i. Return Success** (Line 371-390)
   ```typescript
   return {
     token,
     customer: {
       id, email, first_name, last_name,
       customer_id, tenant_id
     },
     tenant: {
       id, business_name, slug
     },
     customerRecord: customer // Legacy customer data
   };
   ```

3. **Store in localStorage** (Line 185-190)
   ```typescript
   setToken(data.token);
   setCustomer(data.customer);
   setTenant(data.tenant);
   localStorage.setItem(TOKEN_KEY, data.token);
   localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
   localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
   ```

4. **Redirect to Dashboard** (Line 87)
   ```typescript
   navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
   ```

#### 3.4 Error Handling

**Email Not Verified:**
- Catches `requires_verification` error
- Redirects to verification page with email pre-filled
- Shows toast: "Email not verified. Please verify your email address."

**Invalid Credentials:**
- Shows toast: "Invalid credentials"
- Clears password field

**Network Errors:**
- Shows toast: "Login failed. Please try again."

---

## 4. Customer Portal Access

### URL: `/{tenantSlug}/shop` or `/{tenantSlug}/shop/dashboard`

### Route Protection: `CustomerProtectedRoute`

### Component: `CustomerPortal` → `CustomerDashboardPage`

### Flow Details:

#### 4.1 Route Protection (`CustomerProtectedRoute.tsx`)

**Initialization:**
1. **Load from localStorage** (Line 92-114)
   ```typescript
   const storedToken = localStorage.getItem(TOKEN_KEY);
   const storedCustomer = localStorage.getItem(CUSTOMER_KEY);
   const storedTenant = localStorage.getItem(TENANT_KEY);
   ```

2. **Verify Token** (Line 103)
   - Calls `verifyToken()` if token exists
   - Validates token with edge function

3. **Local Slug Verification** (Line 93-98)
   ```typescript
   if (tenantSlug && tenant.slug !== tenantSlug) {
     navigate(`/${tenant.slug}/shop/login`, { replace: true });
     return;
   }
   ```

4. **Verification Cache** (Line 100-106)
   - Caches verification results for 2 minutes
   - Prevents repeated server calls

5. **Render Protected Content** (Line 145)
   - Only renders if `token`, `customer`, and `tenant` all exist

#### 4.2 Dashboard Page (`CustomerDashboardPage.tsx`)

**Layout Structure:**

1. **Mobile Navigation** (`CustomerMobileNav`)
   - Top navigation bar for mobile
   - Shows tenant logo, search, cart icon

2. **Desktop Header** (Line 74-94)
   - Business name
   - Welcome message with customer name
   - Settings button
   - Logout button

3. **Quick Stats Cards** (Line 98-143)
   - **Total Orders**: Count of all orders
   - **Total Spent**: Sum of all order totals
   - **Member Since**: Years as customer

4. **Available Menus** (Line 146-158)
   - Shows disposable menus available to customer
   - Links to menu viewing pages
   - Uses `MenuList` component

5. **Recent Orders** (Line 161-211)
   - Fetches last 5 orders from database
   - Shows order number, date, total, status
   - Clickable → Navigates to order detail page
   - Empty state if no orders

6. **Mobile Bottom Navigation** (`CustomerMobileBottomNav`)
   - Home, Orders, Cart, Settings icons
   - Sticky bottom navigation

#### 4.3 Data Fetching

**Recent Orders Query** (Line 28-44)
```typescript
useQuery({
  queryKey: ["customer-orders", tenantId, customerId],
  queryFn: async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total_amount, status, created_at")
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5);
    return data || [];
  },
  enabled: !!tenantId && !!customerId,
});
```

---

## 5. Shopping Experience

### 5.1 Menu Access

**URL**: `/{tenantSlug}/shop/menus` or via secure menu links

**Features:**
- Browse available disposable menus
- View menu products
- Add items to cart
- Secure menu access with tokens

### 5.2 Shopping Cart

**URL**: `/{tenantSlug}/shop/cart`

**Component**: `ShoppingCartPage` (`src/pages/customer/ShoppingCartPage.tsx`)

**Features:**

1. **Cart Items Display**
   - Shows product name, image, quantity
   - Price per unit/weight
   - Total price per item
   - Remove item button
   - Update quantity controls

2. **Cart Management**
   - **Authenticated Users**: Cart stored in `cart_items` table
   - **Guest Users**: Cart stored in localStorage (`guest_cart`)
   - Auto-migrates guest cart to database on login

3. **Order Notes** (Line 34)
   - Text area for special instructions
   - Saved with order

4. **Checkout Button**
   - Navigates to checkout page
   - Validates cart is not empty

### 5.3 Checkout Process

**URL**: `/{tenantSlug}/shop/checkout`

**Component**: `CheckoutPage` (`src/pages/customer/CheckoutPage.tsx`)

**Multi-Step Checkout:**

#### Step 1: Delivery Information
- **Address Selection**
  - Saved addresses dropdown
  - "Add New Address" button
  - Address form (street, city, state, zip, borough)
- **Preferred Delivery Date**
  - Date picker
  - Time slot selection (if available)
- **Delivery Instructions**
  - Text area for special notes

#### Step 2: Payment Method
- **Payment Options:**
  - Credit/Debit Card
  - Terms (Net 30, Net 60, etc.)
  - Cash on Delivery (COD)
- **Card Details** (if card selected)
  - Card number, expiry, CVV
  - Billing address

#### Step 3: Review Order
- **Order Summary**
  - Items list with quantities
  - Subtotal
  - Delivery fee
  - Tax
  - **Total**
- **Delivery Address**
- **Payment Method**
- **Order Notes**

#### Step 4: Place Order
- **Submit Order**
  - Creates order in `orders` table
  - Creates `order_items` for each cart item
  - Generates order number
  - Sends confirmation email
- **Success State**
  - Shows order number
  - Redirects to order tracking page

---

## 6. Order Management

### 6.1 Orders List

**URL**: `/{tenantSlug}/shop/orders`

**Component**: `OrdersListPage` (`src/pages/customer/OrdersListPage.tsx`)

**Features:**

1. **All Orders Display**
   - Fetches all orders for customer
   - Sorted by date (newest first)
   - Shows order number, date, total, status

2. **Order Status Badges**
   - **Pending**: Yellow badge
   - **Accepted**: Blue badge
   - **Preparing**: Purple badge
   - **Out for Delivery**: Indigo badge
   - **Delivered**: Green badge
   - **Cancelled**: Red badge

3. **Order Actions**
   - Click order → Navigate to order detail
   - View tracking information
   - Cancel order (if pending)

4. **Empty State**
   - Shows "No orders yet" message
   - Link to browse menus

### 6.2 Order Tracking

**URL**: `/{tenantSlug}/shop/orders/:orderId`

**Component**: `OrderTrackingPage`

**Features:**

1. **Order Details**
   - Order number
   - Order date
   - Status timeline
   - Estimated delivery time

2. **Items List**
   - Product names
   - Quantities
   - Prices
   - Subtotal

3. **Delivery Information**
   - Delivery address
   - Courier information (if assigned)
   - Real-time GPS tracking (if available)

4. **Payment Information**
   - Payment method
   - Total amount
   - Invoice link (if available)

---

## 7. Account Settings

### URL: `/{tenantSlug}/shop/settings`

### Component: `CustomerSettingsPage` (`src/pages/customer/SettingsPage.tsx`)

### Features:

#### 7.1 Profile Information
- **Name**: First name, last name
- **Email**: Read-only (cannot change)
- **Phone**: Editable
- **Date of Birth**: Editable (if provided)

#### 7.2 Password Management
- **Change Password**
  - Current password
  - New password (with strength indicator)
  - Confirm new password
  - Calls `customer-auth?action=update-password`

#### 7.3 Address Management
- **Saved Addresses**
  - List of saved delivery addresses
  - Add new address
  - Edit existing address
  - Delete address
  - Set default address

#### 7.4 Notification Preferences
- Email notifications
- SMS notifications (if enabled)
- Order updates
- Promotional emails

#### 7.5 Session Management
- **Active Sessions**
  - List of devices/browsers logged in
  - Last activity time
  - IP address
  - "Logout from this device" button

#### 7.6 Data Export
- **Export Account Data** (GDPR compliance)
  - Downloads all customer data as JSON
  - Includes orders, addresses, profile

#### 7.7 Account Deletion
- **Delete Account**
  - Confirmation dialog
  - Permanently deletes account
  - Cancels pending orders
  - Sends confirmation email

---

## 8. Security & Authentication

### 8.1 Token Management

**Token Storage:**
- `localStorage.getItem('customer_access_token')`
- `localStorage.getItem('customer_user')`
- `localStorage.getItem('customer_tenant_data')`

**Token Expiration:**
- **Access Token**: 30 days
- **Refresh**: Auto-verifies before expiration
- **Session**: Stored in `customer_sessions` table

### 8.2 Token Verification

**Process:**
1. **On Page Load**: Verifies token with edge function
2. **On Route Change**: Cached verification (2 minutes)
3. **Before Expiration**: Proactive refresh

**Edge Function**: `customer-auth?action=verify`
- Validates JWT signature
- Checks session exists in database
- Verifies customer is active
- Returns customer and tenant data

### 8.3 Security Checkpoints

1. **Email Verification Required** ⭐
   - Cannot login without verified email
   - Verification code expires in 15 minutes

2. **Cross-Table Email Validation** ⭐
   - Prevents staff emails from signing up as customers
   - Prevents customer emails from being invited as staff

3. **Age Verification**
   - Validates minimum age (default: 21)
   - Required if tenant has `age_verification_required = true`

4. **Password Security**
   - Minimum 8 characters
   - Hashed with bcrypt
   - Never stored in plain text

5. **Session Management**
   - Sessions tracked in database
   - IP address and user agent logged
   - Can revoke sessions from settings

6. **Route Protection**
   - All customer routes protected by `CustomerProtectedRoute`
   - Verifies tenant slug matches URL
   - Redirects to login if not authenticated

### 8.4 Error Handling

**Common Errors:**

1. **Email Not Verified**
   - Status: 403
   - Action: Redirect to verification page
   - Message: "Please verify your email address before logging in."

2. **Invalid Credentials**
   - Status: 401
   - Action: Show error toast
   - Message: "Invalid credentials"

3. **Email Already Exists**
   - Status: 409
   - Action: Show error toast
   - Message: "An account with this email already exists"

4. **Staff Account Conflict**
   - Status: 409
   - Action: Show error with admin login link
   - Message: "This email is registered as a staff account. Please use the staff login."

5. **Age Verification Failed**
   - Status: 403
   - Action: Show error toast
   - Message: "You must be at least {age} years old to create an account"

---

## 📊 Complete Flow Diagram

```
User Action → Frontend → Edge Function → Database → Response → Frontend → UI
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     ▼           ▼             ▼            ▼          ▼          ▼        ▼
  Click      SignUpPage   customer-auth   customer_  Success   Store    Redirect
  Signup     Component    Edge Function   users      Response  Tokens   Verify
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     └───────────┴─────────────┴────────────┴──────────┴──────────┴────────┘
     
  Verify      VerifyEmail  verify-email-  email_     Success   Update   Redirect
  Email       Page         code           verified   Response  Status   Login
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     └───────────┴─────────────┴────────────┴──────────┴──────────┴────────┘
     
  Login       LoginPage    customer-auth  customer_  Token     Store    Dashboard
             Component     Edge Function  sessions   Response  Tokens   Page
     │           │             │            │          │          │        │
     │           │             │            │          │          │        │
     └───────────┴─────────────┴────────────┴──────────┴──────────┴────────┘
```

---

## 🎯 Key URLs in Customer Flow

1. **Signup**: `/{slug}/customer/signup`
2. **Verification**: `/{slug}/customer/verify-email?email={email}`
3. **Login**: `/{slug}/customer/login` or `/{slug}/shop/login`
4. **Dashboard**: `/{slug}/shop` or `/{slug}/shop/dashboard`
5. **Cart**: `/{slug}/shop/cart`
6. **Checkout**: `/{slug}/shop/checkout`
7. **Orders**: `/{slug}/shop/orders`
8. **Order Detail**: `/{slug}/shop/orders/:orderId`
9. **Settings**: `/{slug}/shop/settings`

---

## ⚠️ Error Scenarios & Handling

### Scenario 1: Email Not Verified
- **Error**: 403 "Email not verified"
- **Action**: Redirect to verification page
- **Message**: "Please verify your email address before logging in."

### Scenario 2: Email Already Exists
- **Error**: 409 "An account with this email already exists"
- **Action**: Show error toast
- **Message**: "An account with this email already exists. Please sign in instead."

### Scenario 3: Staff Account Conflict
- **Error**: 409 "This email is registered as a staff account"
- **Action**: Show error with link
- **Message**: "This email is registered as a staff account. Please use the staff login at /{slug}/admin/login instead."

### Scenario 4: Age Verification Failed
- **Error**: 403 "You must be at least {age} years old"
- **Action**: Show error toast
- **Message**: "You must be at least {age} years old to create an account"

### Scenario 5: Token Expired
- **Error**: 401 "Token expired or invalid"
- **Action**: Clear auth state, redirect to login
- **Message**: "Your session has expired. Please log in again."

### Scenario 6: Tenant Mismatch
- **Error**: Tenant slug doesn't match authenticated tenant
- **Action**: Redirect to correct tenant login
- **Message**: "You are logged into a different store. Please log in to this store."

---

## 🔄 Auto-Login After Verification

### Why It Doesn't Auto-Login:

1. **Security**: Password still required for login
2. **User Experience**: User enters password once after verification
3. **Email Pre-filled**: Login page shows verified email

### Flow:
1. User verifies email → Redirects to login with `?verified=true&email={email}`
2. Login page pre-fills email
3. User enters password
4. Login succeeds immediately (email already verified)

---

## 📝 Summary: Complete Customer Flow

1. **User visits** `/{slug}/customer/signup` → Fills signup form
2. **Submits form** → Edge function validates and creates account
3. **Email sent** → 6-digit verification code
4. **User verifies** → `/{slug}/customer/verify-email`
5. **Redirects to login** → Email pre-filled, password required
6. **User logs in** → Token generated, stored in localStorage
7. **Dashboard loads** → Shows orders, menus, stats
8. **User shops** → Adds items to cart
9. **Checkout** → Multi-step checkout process
10. **Order placed** → Order created, confirmation sent
11. **Order tracking** → View order status and details

**Total Time**: ~10-15 seconds from signup to dashboard (excluding email verification)

---

## 🎨 User Experience Highlights

- ✅ **Email verification required** (security)
- ✅ **Age verification** (compliance)
- ✅ **Cross-table email validation** (prevents conflicts)
- ✅ **Password strength indicator** (real-time feedback)
- ✅ **Mobile-responsive design** (works on all devices)
- ✅ **Guest cart support** (can shop before signing up)
- ✅ **Auto-migrate guest cart** (on login)
- ✅ **Session management** (view/revoke sessions)
- ✅ **Order tracking** (real-time status updates)
- ✅ **Secure token storage** (30-day expiration)

---

**This flow ensures a secure, compliant, and user-friendly experience for customers from signup to order completion.**

