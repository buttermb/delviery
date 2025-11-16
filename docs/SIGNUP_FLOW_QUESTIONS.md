# 30 Specific Questions: Customer Signup & Tenant Portal Setup

## 🔵 CUSTOMER SIGNUP FLOW (B2C - End Customers)

### 1. **Tenant Slug Resolution**
   - **Q:** When a customer visits `/{tenantSlug}/customer/signup`, how is the tenant validated?
   - **Current:** `SignUpPage.tsx` fetches tenant by slug from `tenants` table
   - **Question:** What happens if `tenantSlug` is invalid/missing? Should we show 404 or redirect?
   - **Question:** Should we cache tenant data or always fetch fresh?

### 2. **Email Uniqueness Scope**
   - **Q:** Can the same email sign up as a customer for multiple tenants?
   - **Current:** `customer-auth` checks `customer_users.email + tenant_id` uniqueness
   - **Question:** If customer@example.com signs up for Tenant A, can they also sign up for Tenant B?
   - **Question:** Should we prevent duplicate emails across all tenants or allow per-tenant?

### 3. **Password Requirements**
   - **Q:** What are the exact password requirements for customer signup?
   - **Current:** Minimum 8 characters (client-side only)
   - **Question:** Should we enforce complexity (uppercase, numbers, symbols)?
   - **Question:** Should password requirements match tenant admin requirements?

### 4. **Phone Number Validation**
   - **Q:** Is phone number required or optional for customer signup?
   - **Current:** Phone is optional in form but stored if provided
   - **Question:** Should we validate phone format (US format, international)?
   - **Question:** Should we normalize phone numbers (remove dashes, spaces)?

### 5. **Email Verification Flow**
   - **Q:** Do customers need to verify their email before accessing the portal?
   - **Current:** No email verification in `customer-auth` signup
   - **Question:** Should we send verification email after signup?
   - **Question:** What happens if customer tries to login before verifying?

### 6. **Post-Signup Redirect**
   - **Q:** Where should customers be redirected after successful signup?
   - **Current:** Redirects to `/{tenantSlug}/customer/login`
   - **Question:** Should we auto-login after signup or require manual login?
   - **Question:** Should redirect URL be configurable per tenant?

### 7. **Customer Profile Creation**
   - **Q:** What customer profile data is created during signup?
   - **Current:** Creates `customer_users` record + `customers` record
   - **Question:** Should we create default `loyalty_points`, `customer_type`, `status`?
   - **Question:** Should we auto-assign customer to a default group/segment?

### 8. **Age Verification**
   - **Q:** Is age verification required during customer signup?
   - **Current:** No age verification in signup flow
   - **Question:** Should we add age verification checkbox/date picker?
   - **Question:** Should age verification be stored and audited?

### 9. **Signup Error Handling**
   - **Q:** What specific error messages should customers see?
   - **Current:** Generic "Signup failed" message
   - **Question:** Should we show specific errors (email exists, weak password, tenant inactive)?
   - **Question:** Should we log failed signup attempts for security?

### 10. **Tenant Status Check**
   - **Q:** What happens if customer tries to sign up for an inactive/suspended tenant?
   - **Current:** `customer-auth` checks `tenant.status = 'active'`
   - **Question:** Should we show a specific message ("This store is currently unavailable")?
   - **Question:** Should we allow signup but prevent login until tenant is active?

---

## 🟢 TENANT SIGNUP FLOW (B2B - Business Signup)

### 11. **Business Name Validation**
   - **Q:** Are there restrictions on business name format/characters?
   - **Current:** No validation beyond required field
   - **Question:** Should we prevent special characters, profanity, or reserved names?
   - **Question:** Should business name be unique across all tenants?

### 12. **URL Slug Generation**
   - **Q:** How is the tenant URL slug generated and validated?
   - **Current:** `tenant-signup` generates slug from business name (lowercase, spaces to hyphens)
   - **Question:** Should we allow custom slugs or auto-generate only?
   - **Question:** What happens if generated slug already exists? Auto-append number?

### 13. **Email Uniqueness (Tenant)**
   - **Q:** Can the same email be used for multiple tenant accounts?
   - **Current:** Checks `tenants.owner_email` uniqueness
   - **Question:** Should owner email be unique globally or allow multiple tenants per email?
   - **Question:** What if someone wants to manage multiple businesses?

### 14. **Trial Period Setup**
   - **Q:** What is the exact trial period duration and when does it start?
   - **Current:** 14 days from signup, stored in `trial_ends_at`
   - **Question:** Should trial start immediately or after email verification?
   - **Question:** Should trial period be configurable per subscription plan?

### 15. **Default Limits Assignment**
   - **Q:** What default limits are assigned to new tenants?
   - **Current:** Hardcoded in `tenant-signup`: customers: 50, menus: 3, products: 100, locations: 2, users: 3
   - **Question:** Should limits be based on subscription plan or fixed for all?
   - **Question:** Should we allow super admin to customize default limits?

### 16. **Owner Role Assignment**
   - **Q:** How is the tenant owner role assigned during signup?
   - **Current:** Creates `tenant_users` record with `role = 'owner'`
   - **Question:** Should owner role have all permissions by default?
   - **Question:** Can owner role be changed/transferred after signup?

### 17. **Subscription Plan Default**
   - **Q:** What subscription plan is assigned to new tenants?
   - **Current:** Always `'starter'` with `subscription_status = 'trial'`
   - **Question:** Should we allow selecting plan during signup?
   - **Question:** Should trial automatically convert to paid after 14 days?

### 18. **Tenant Signup Email Confirmation**
   - **Q:** Do tenant owners need to verify email before accessing dashboard?
   - **Current:** Uses Supabase Auth signup which sends verification email
   - **Question:** Should we block dashboard access until email verified?
   - **Question:** Should we send welcome email with setup instructions?

### 19. **Tenant Creation Rollback**
   - **Q:** What happens if tenant creation fails after auth user is created?
   - **Current:** `tenant-signup` deletes auth user if tenant creation fails
   - **Question:** Should we also clean up any partial tenant data?
   - **Question:** Should we log failed tenant creations for debugging?

### 20. **Post-Signup Onboarding**
   - **Q:** What happens immediately after tenant signup?
   - **Current:** Redirects to `/saas/login?signup=success&tenant={slug}`
   - **Question:** Should we redirect to welcome/onboarding page?
   - **Question:** Should we pre-populate any demo data or leave empty?

---

## 🔗 TENANT PORTAL LINK GENERATION & SHARING

### 21. **Portal Link Format**
   - **Q:** What is the exact format of tenant portal links?
   - **Current:** `/{tenantSlug}/customer/signup` and `/{tenantSlug}/customer/login`
   - **Question:** Should we support custom domains per tenant (e.g., `shop.tenantname.com`)?
   - **Question:** Should portal links be shareable or require authentication?

### 22. **Link Expiration**
   - **Q:** Do tenant portal links expire or are they permanent?
   - **Current:** Links are permanent (based on tenant slug)
   - **Question:** Should we support time-limited signup links for promotions?
   - **Question:** Should we track link usage/analytics?

### 23. **Custom Portal Branding**
   - **Q:** Can tenants customize their portal link appearance/branding?
   - **Current:** No customization options visible
   - **Question:** Should tenants be able to set custom logo, colors, domain?
   - **Question:** Should branding be a premium feature (Professional/Enterprise only)?

### 24. **Portal Access Control**
   - **Q:** Can tenants disable customer signup while keeping portal active?
   - **Current:** No disable option visible
   - **Question:** Should we add "Allow Customer Signup" toggle in tenant settings?
   - **Question:** Should we support invite-only mode (no public signup)?

### 25. **Link Sharing Permissions**
   - **Q:** Who can generate/share tenant portal links?
   - **Current:** Any tenant admin can access portal URLs
   - **Question:** Should link sharing be restricted to owner role only?
   - **Question:** Should we track who shared links and when?

---

## 🔐 AUTHENTICATION & ACCESS CONTROL

### 26. **Customer Login After Signup**
   - **Q:** Can customers login immediately after signup or must they wait?
   - **Current:** Redirects to login page (requires manual login)
   - **Question:** Should we auto-login customers after signup for better UX?
   - **Question:** Should auto-login be optional (configurable per tenant)?

### 27. **Session Management**
   - **Q:** How long do customer sessions last?
   - **Current:** Uses Supabase Auth sessions (default expiration)
   - **Question:** Should session duration be configurable per tenant?
   - **Question:** Should we support "Remember Me" with longer sessions?

### 28. **Password Reset Flow**
   - **Q:** How do customers reset forgotten passwords?
   - **Current:** No password reset visible in customer portal
   - **Question:** Should we add "Forgot Password" link on login page?
   - **Question:** Should password reset emails be tenant-branded?

### 29. **Multi-Device Access**
   - **Q:** Can customers access portal from multiple devices simultaneously?
   - **Current:** No device restrictions visible
   - **Question:** Should we limit concurrent sessions per customer?
   - **Question:** Should we show active sessions in customer profile?

### 30. **Account Deletion/Deactivation**
   - **Q:** Can customers delete their own accounts?
   - **Current:** No self-service account deletion
   - **Question:** Should we add "Delete Account" option in customer settings?
   - **Question:** Should account deletion be soft-delete (deactivate) or hard-delete?
   - **Question:** What happens to customer's order history after deletion?

---

## 📋 ADDITIONAL CLARIFICATIONS NEEDED

### Data Initialization
- Should we create default customer groups/segments during tenant signup?
- Should we seed sample products/menus for new tenants?
- Should we create default payment methods/settings?

### Error Recovery
- What happens if email service is down during signup?
- Should we queue failed signups for retry?
- How do we handle duplicate signup attempts (race conditions)?

### Analytics & Tracking
- Should we track signup source (referral, direct, social media)?
- Should we track signup conversion funnel (started → completed)?
- Should we log all signup attempts (successful and failed)?

### Compliance
- Do we need GDPR consent checkbox during signup?
- Should we store IP address for signup audit trail?
- Do we need terms of service acceptance checkbox?

---

**Please answer each question with:**
1. ✅ Current implementation status
2. ⚠️ What needs fixing/verification
3. 💡 Recommendation/decision needed

