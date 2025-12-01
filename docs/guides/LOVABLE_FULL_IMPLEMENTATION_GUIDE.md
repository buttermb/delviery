# 🌟 FloraIQ Platform - Complete Lovable Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Schema Setup](#database-schema-setup)
4. [Edge Functions Setup](#edge-functions-setup)
5. [Frontend Integration](#frontend-integration)
6. [Feature Flags & Permissions](#feature-flags--permissions)
7. [Navigation & Routing](#navigation--routing)
8. [Testing Checklist](#testing-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Post-Deployment](#post-deployment)

---

## 🎯 Overview

This guide covers the complete integration of all recently implemented features:
- ✅ Quick-create listing from products
- ✅ Marketplace messaging system
- ✅ Enhanced onboarding checklist
- ✅ Business verification in mode switcher
- ✅ Marketplace navigation

**Estimated Integration Time:** 2-3 hours

---

## 📦 Prerequisites

### Required Database Tables
Ensure these tables exist (from `supabase/migrations/20250128000000_marketplace_tables.sql`):
- `marketplace_profiles`
- `marketplace_listings`
- `marketplace_orders`
- `marketplace_order_items`
- `marketplace_messages`
- `marketplace_reviews`
- `marketplace_cart`
- `platform_transactions`

### Required Edge Functions
- `create-marketplace-profile`
- `create-marketplace-order`
- `customer-auth` (updated for business buyers)

### Required Supabase Storage Buckets
- `product-images` (for listing images)
- `marketplace-documents` (for license documents)

---

## 🗄️ Database Schema Setup

### Step 1: Run Marketplace Migration

In Lovable's Supabase SQL Editor, run:

```sql
-- File: supabase/migrations/20250128000000_marketplace_tables.sql
-- This creates all marketplace tables with RLS policies
```

**Key Tables to Verify:**

1. **marketplace_profiles**
   - Columns: `tenant_id`, `business_name`, `license_verified`, `can_sell`, `marketplace_status`
   - RLS: Enabled with tenant isolation

2. **marketplace_messages**
   - Columns: `sender_tenant_id`, `receiver_tenant_id`, `message_text`, `read`, `listing_id`, `order_id`
   - RLS: Enabled with tenant isolation

3. **marketplace_listings**
   - Columns: `tenant_id`, `product_name`, `base_price`, `quantity_available`, `status`
   - RLS: Enabled with tenant isolation

### Step 2: Verify RLS Policies

Check that Row Level Security is enabled on all marketplace tables:

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'marketplace_%';
```

All should show `rowsecurity = true`.

### Step 3: Verify Indexes

Ensure these indexes exist for performance:

```sql
-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'marketplace_%';
```

Required indexes:
- `idx_marketplace_messages_sender_tenant_id`
- `idx_marketplace_messages_receiver_tenant_id`
- `idx_marketplace_messages_read`
- `idx_marketplace_listings_tenant_id`
- `idx_marketplace_orders_seller_tenant_id`

---

## ⚡ Edge Functions Setup

### Step 1: Create Marketplace Profile Function

**File:** `supabase/functions/create-marketplace-profile/index.ts`

```typescript
// Already implemented - verify it exists
// Handles profile creation/update with encryption
```

**Verify:**
- ✅ Function exists in Lovable's Edge Functions
- ✅ Handles encryption for sensitive fields
- ✅ Validates license documents
- ✅ Sets `marketplace_status` to 'pending' initially

### Step 2: Create Marketplace Order Function

**File:** `supabase/functions/create-marketplace-order/index.ts`

```typescript
// Already implemented - verify it exists
// Handles order creation with platform fee calculation
```

**Verify:**
- ✅ Calculates 2% platform fee
- ✅ Creates `marketplace_orders` record
- ✅ Creates `marketplace_order_items` records
- ✅ Creates `platform_transactions` record

### Step 3: Update Customer Auth Function

**File:** `supabase/functions/customer-auth/index.ts`

**Required Changes:**
- ✅ Accepts `isBusinessBuyer`, `businessName`, `businessLicenseNumber`
- ✅ Creates `marketplace_profiles` record for business buyers
- ✅ Sets `can_sell: false` and `marketplace_status: 'pending'`

**Verify the validation schema includes:**
```typescript
isBusinessBuyer: z.boolean().optional().default(false),
businessName: z.string().max(255).optional(),
businessLicenseNumber: z.string().max(100).optional(),
```

---

## 🎨 Frontend Integration

### Step 1: Verify File Structure

Ensure these files exist:

```
src/
├── pages/
│   ├── tenant-admin/
│   │   ├── marketplace/
│   │   │   ├── MessagesPage.tsx ✅ NEW
│   │   │   ├── ListingForm.tsx (updated)
│   │   │   ├── MyListingsPage.tsx
│   │   │   └── MarketplaceOrdersPage.tsx
│   │   └── DashboardPage.tsx (updated)
│   ├── admin/
│   │   └── ProductManagement.tsx (updated)
│   └── customer/
│       ├── DashboardPage.tsx (updated)
│       └── SettingsPage.tsx (updated)
├── components/
│   ├── admin/
│   │   └── EnhancedProductTable.tsx (updated)
│   ├── customer/
│   │   ├── ModeSwitcher.tsx (updated)
│   │   └── BusinessVerificationCard.tsx
└── lib/
    ├── sidebar/
    │   └── sidebarConfigs.ts (updated)
    └── featureConfig.ts (updated)
```

### Step 2: Verify Routes in App.tsx

**File:** `src/App.tsx`

Ensure these routes exist:

```typescript
// Marketplace routes (within tenant admin section)
<Route path="marketplace/profile" element={...} />
<Route path="marketplace/listings" element={...} />
<Route path="marketplace/listings/new" element={...} />
<Route path="marketplace/listings/:listingId" element={...} />
<Route path="marketplace/listings/:listingId/edit" element={...} />
<Route path="marketplace/orders" element={...} />
<Route path="marketplace/orders/:orderId" element={...} />
<Route path="marketplace/messages" element={...} /> ✅ NEW
```

### Step 3: Verify Lazy Imports

**File:** `src/App.tsx`

Ensure MessagesPage is imported:

```typescript
const MessagesPage = lazy(() => import("./pages/tenant-admin/marketplace/MessagesPage"));
```

### Step 4: Verify Sidebar Configuration

**File:** `src/lib/sidebar/sidebarConfigs.ts`

Ensure Marketplace section exists in `MEDIUM_BUSINESS_SIDEBAR`:

```typescript
{
  section: '🌐 Marketplace',
  items: [
    createItem('marketplace', 'My Listings', '/admin/marketplace/listings', Store),
    createItem('marketplace', 'Create Listing', '/admin/marketplace/listings/new', Store),
    createItem('marketplace', 'Wholesale Orders', '/admin/marketplace/orders', ShoppingCart),
    createItem('marketplace', 'Messages', '/admin/marketplace/messages', MessageSquare, { hot: true }),
    createItem('marketplace', 'Seller Profile', '/admin/marketplace/profile', User),
  ],
}
```

### Step 5: Verify Feature Configuration

**File:** `src/lib/featureConfig.ts`

Ensure marketplace feature exists:

```typescript
'marketplace': {
  id: 'marketplace',
  name: 'Wholesale Marketplace',
  description: 'List products on B2B marketplace, manage wholesale orders, and communicate with buyers',
  tier: 'professional',
  category: 'Marketplace',
  route: '/admin/marketplace/listings',
},
```

---

## 🔐 Feature Flags & Permissions

### Step 1: Verify Feature Protection

All marketplace routes should be wrapped with `FeatureProtectedRoute`:

```typescript
<Route 
  path="marketplace/messages" 
  element={
    <FeatureProtectedRoute featureId="marketplace">
      <MessagesPage />
    </FeatureProtectedRoute>
  } 
/>
```

### Step 2: Verify Subscription Tier Check

**File:** `src/pages/admin/ProductManagement.tsx`

The "List on Marketplace" action checks subscription tier:

```typescript
const subscriptionPlan = tenant?.subscription_plan || 'starter';
const canAccessMarketplace = 
  subscriptionPlan === 'professional' || 
  subscriptionPlan === 'enterprise' || 
  subscriptionPlan === 'medium';
```

**Required Tiers:**
- ✅ `professional` (Medium tier)
- ✅ `enterprise` (Enterprise tier)
- ✅ `medium` (legacy Medium tier)

### Step 3: Verify RLS Policies

Test that RLS policies work correctly:

```sql
-- Test as tenant admin
-- Should only see own marketplace data
SELECT * FROM marketplace_listings WHERE tenant_id = '<your-tenant-id>';
```

---

## 🧭 Navigation & Routing

### Step 1: Verify Sidebar Appears

**For Medium+ Businesses:**
1. Log in as a tenant with `subscription_plan = 'professional'` or `'enterprise'`
2. Navigate to `/admin/dashboard`
3. Check sidebar for "🌐 Marketplace" section
4. Verify "Messages" item has a "hot" badge

### Step 2: Verify Quick-Create Flow

**From Products Page:**
1. Navigate to `/admin/inventory/products`
2. Click "•••" menu on any product
3. Verify "List on Marketplace" option appears
4. Click it → Should navigate to `/admin/marketplace/listings/new`
5. Verify form is pre-filled with product data

### Step 3: Verify Messages Access

**From Sidebar:**
1. Click "Messages" in Marketplace section
2. Should navigate to `/admin/marketplace/messages`
3. Should show conversation list (empty if no messages)

### Step 4: Verify Onboarding Checklist

**On Dashboard:**
1. Navigate to `/admin/dashboard`
2. If onboarding < 100%, should see "Setup Progress" card
3. Verify all 4 steps are listed
4. Click "Continue Setup" → Should navigate to first incomplete step

---

## ✅ Testing Checklist

### Database Tests

- [ ] All marketplace tables exist
- [ ] RLS policies are enabled
- [ ] Indexes are created
- [ ] Foreign key constraints work
- [ ] Can insert test data

### Edge Function Tests

- [ ] `create-marketplace-profile` creates profile
- [ ] `create-marketplace-order` creates order with fees
- [ ] `customer-auth` creates buyer profiles
- [ ] Encryption works for sensitive data

### Frontend Tests

- [ ] Messages page loads without errors
- [ ] Product "List on Marketplace" action works
- [ ] Listing form pre-fills from product data
- [ ] Onboarding checklist appears on dashboard
- [ ] Mode switcher shows verification status
- [ ] Marketplace sidebar section appears for Medium+ users

### Integration Tests

- [ ] Can create listing from product
- [ ] Can send/receive messages
- [ ] Messages mark as read correctly
- [ ] Onboarding progress updates correctly
- [ ] Business verification flow works
- [ ] Feature protection blocks unauthorized access

### Performance Tests

- [ ] Messages page loads in < 2 seconds
- [ ] Conversation list renders smoothly
- [ ] Real-time updates work (30s polling)
- [ ] No memory leaks in message subscriptions

---

## 🔧 Troubleshooting

### Issue: Messages Page Shows "No Messages"

**Possible Causes:**
1. No messages exist in database
2. RLS policy blocking access
3. Tenant ID mismatch

**Solution:**
```sql
-- Check if messages exist
SELECT * FROM marketplace_messages 
WHERE receiver_tenant_id = '<your-tenant-id>' 
OR sender_tenant_id = '<your-tenant-id>';

-- Check RLS policy
SELECT * FROM pg_policies 
WHERE tablename = 'marketplace_messages';
```

### Issue: "List on Marketplace" Not Appearing

**Possible Causes:**
1. Subscription tier too low
2. Feature flag not enabled
3. Component not updated

**Solution:**
1. Check tenant subscription: `SELECT subscription_plan FROM tenants WHERE id = '<tenant-id>';`
2. Verify feature config includes marketplace
3. Check `EnhancedProductTable` has `onListOnMarketplace` prop

### Issue: Onboarding Checklist Not Showing

**Possible Causes:**
1. Progress is 100%
2. Usage data not populated
3. Component commented out

**Solution:**
```typescript
// Check tenant usage
const tenantUsage = (tenant as any)?.usage || {};
console.log('Usage:', tenantUsage);

// Verify onboarding progress calculation
const completedSteps = onboardingSteps.filter(step => step.completed).length;
const progress = (completedSteps / onboardingSteps.length) * 100;
```

### Issue: Sidebar Marketplace Section Missing

**Possible Causes:**
1. Operation size detection wrong
2. Subscription tier too low
3. Sidebar config not updated

**Solution:**
1. Check operation size: `useAdaptiveSidebar` hook
2. Verify subscription tier is Medium+
3. Check `MEDIUM_BUSINESS_SIDEBAR` includes Marketplace section

### Issue: TypeScript Errors

**Common Errors:**
- `MessageSquare` not imported
- `Store` icon not found
- Type mismatches

**Solution:**
```typescript
// Verify imports in sidebarConfigs.ts
import { MessageSquare, Store } from 'lucide-react';

// Verify component exports
export default function MessagesPage() { ... }
```

---

## 🚀 Post-Deployment

### Step 1: Monitor Error Logs

Check Supabase logs for:
- Edge function errors
- RLS policy violations
- Database constraint errors

### Step 2: Test User Flows

**Test as Business Admin:**
1. Create marketplace profile
2. List a product
3. Receive a message from buyer
4. Reply to message
5. Process wholesale order

**Test as Customer:**
1. Sign up as business buyer
2. Verify business license
3. Browse marketplace
4. Send message to seller
5. Place wholesale order

### Step 3: Performance Monitoring

Monitor:
- Message page load times
- Real-time subscription performance
- Database query performance
- Edge function execution times

### Step 4: User Feedback

Collect feedback on:
- Message interface usability
- Quick-create listing workflow
- Onboarding checklist helpfulness
- Business verification process

---

## 📝 Additional Notes

### Environment Variables

No additional environment variables required. All configuration uses:
- Supabase project settings
- Database RLS policies
- Feature flags in code

### Storage Buckets

Ensure these buckets exist in Supabase Storage:
- `product-images` (public read, authenticated write)
- `marketplace-documents` (authenticated read/write)

### Real-time Subscriptions

Messages page uses polling (30s interval) instead of real-time subscriptions for reliability. Can be upgraded to real-time later if needed.

### Encryption

Sensitive marketplace data (lab results, financial info) uses AES-256 encryption via `src/lib/encryption/aes256.ts`.

---

## 🎉 Success Criteria

Integration is successful when:

✅ All marketplace routes are accessible  
✅ Messages page loads and displays conversations  
✅ Quick-create listing pre-fills form correctly  
✅ Onboarding checklist appears and updates  
✅ Business verification works in mode switcher  
✅ Marketplace sidebar section appears for Medium+ users  
✅ No TypeScript or runtime errors  
✅ All features are feature-gated correctly  

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check Supabase logs for database errors
2. Check browser console for frontend errors
3. Verify all files are committed and deployed
4. Test with a fresh tenant account
5. Review RLS policies in Supabase dashboard

---

**Last Updated:** 2025-01-14  
**Version:** 1.0.0  
**Status:** Production Ready ✅

