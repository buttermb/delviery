

# Fix "Business Not Found" - Column Mismatch Errors

## Root Cause

The app shows "Business Not Found" because two database queries are failing with **400 errors** due to selecting columns that don't exist:

1. **`src/lib/tenant.ts`** (lines 101, 115) -- The `getTenantFromSlug` and `getTenantById` functions select non-existent columns from the `tenants` table: `address`, `city`, `zip_code`, `tax_id`, `website`, `subscription_started_at`, `subscription_current_period_start`, `subscription_current_period_end`, `stripe_subscription_id`, `next_billing_date`, `onboarded_at`

2. **`src/contexts/TenantContext.tsx`** (line 46) -- The tenant user query selects `permissions` and `invited_by` from `tenant_users`, but neither column exists.

Since both queries fail, the app thinks the tenant doesn't exist and shows "Business Not Found."

## Fix

### 1. Update `src/lib/tenant.ts` - Remove non-existent columns from select

Replace the select strings in both `getTenantFromSlug` and `getTenantById` to only include columns that actually exist in the `tenants` table. Also update the `Tenant` interface to remove the non-existent fields.

**Columns to remove from select:** `address`, `city`, `zip_code`, `tax_id`, `website`, `subscription_started_at`, `subscription_current_period_start`, `subscription_current_period_end`, `stripe_subscription_id`, `next_billing_date`, `onboarded_at`

**Correct select string:**
`id, business_name, slug, owner_email, owner_name, phone, state, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, suspended_reason, cancelled_at, state_licenses, compliance_verified, onboarded, last_activity_at, created_at, updated_at`

### 2. Update `src/contexts/TenantContext.tsx` - Remove non-existent columns from select

Replace the `tenant_users` select to remove `permissions` and `invited_by`:

**Correct select string:**
`id, tenant_id, email, name, role, status, email_verified, invited_at, accepted_at, last_login_at, created_at, updated_at`

### 3. Update `Tenant` interface in `src/lib/tenant.ts`

Remove the non-existent properties from the interface: `address`, `city`, `zip_code`, `tax_id`, `website`, `subscription_started_at`, `subscription_current_period_start`, `subscription_current_period_end`, `stripe_subscription_id`, `next_billing_date`, `onboarded_at`.

### 4. Update `TenantUser` interface in `src/lib/tenant.ts`

Remove `permissions` and `invited_by` from the interface.

## Technical Details

These are the actual columns in each table:

**`tenants` table:** id, business_name, slug, owner_email, owner_name, phone, state, subscription_plan, subscription_status, trial_ends_at, mrr, limits, features, usage, compliance_verified, onboarded, last_activity_at, created_at, updated_at, payment_method_added, suspended_reason, state_licenses, cancelled_at, white_label, status, stripe_customer_id, plus several onboarding/trial/billing-related columns.

**`tenant_users` table:** id, tenant_id, user_id, email, name, role, status, email_verified, invited_at, accepted_at, created_at, updated_at, plus verification and avatar columns.

