# Admin Panel Comprehensive Audit Report

**Date:** 2025-01-28  
**Status:** In Progress

---

## Phase 1: Project Structure Analysis ✅

### Admin Pages Identified
- **Total Admin Pages:** 100+ files in `src/pages/admin/`
- **Subdirectories:**
  - `catalog/` - 3 pages (Images, Batches, Categories)
  - `locations/` - 2 pages (Warehouses, Runners)
  - `operations/` - 1 page (Receiving)
  - `sales/` - 2 pages (AdminPricing, Pricing)

### State Management
- **Primary:** TanStack Query (React Query) v5
- **Query Key Factory:** `src/lib/queryKeys.ts` (centralized)
- **Real-time Sync:** `useRealtimeSync` hook for automatic cache invalidation
- **Context:** `TenantAdminAuthContext` for auth state

### Routing Structure
- **Pattern:** `/:tenantSlug/admin/*` (tenant-based routes)
- **Route Count:** 100+ admin routes in `App.tsx`
- **Navigation:** `sidebar-navigation.ts` defines menu structure
- **Protection:** `TenantAdminProtectedRoute` and `FeatureProtectedRoute` wrappers

---

## Phase 2: Button & Action Audit (In Progress)

### Issues Found

#### 1. ProductManagement.tsx
**File:** `src/pages/admin/ProductManagement.tsx`
- ❌ **Issue:** Uses manual `loadProducts()` instead of TanStack Query
- ❌ **Issue:** No cache invalidation after mutations
- ❌ **Issue:** Hardcoded query keys (should use `queryKeys` factory)
- ✅ **Status:** Buttons have onClick handlers

#### 2. WholesaleClients.tsx ✅ FIXED
**File:** `src/pages/admin/WholesaleClients.tsx`
- ✅ **Fixed:** "New Client" button now opens CreateClientDialog
- ✅ **Fixed:** "Import" button shows toast notification (coming soon)
- ✅ **Fixed:** Replaced hardcoded query key with `queryKeys.wholesaleClients.list({ filter })`
- ✅ **Fixed:** Phone button now actually calls the client
- ✅ **Fixed:** Added cache invalidation in CreateClientDialog
- **New Component:** Created `CreateClientDialog.tsx` for client creation

#### 3. Hardcoded Query Keys Found
Multiple files using hardcoded query keys instead of `queryKeys` factory:
- `RunnerLocationTracking.tsx`: `['wholesale-runners']`, `['runner-deliveries']`
- `FleetManagement.tsx`: `["active-deliveries"]`, `["runners"]`
- `AdminPricingPage.tsx`: `['products-pricing']`
- `ImagesPage.tsx`: `['product-images']`, `['products-for-images']`
- `CategoriesPage.tsx`: `['categories']`
- `CashRegister.tsx`: `['pos-products']`, `['cash-register-transactions']`

---

## Phase 3: Route Connectivity Audit (Pending)

### Navigation vs Routes
- Need to verify all navigation items in `sidebar-navigation.ts` have corresponding routes in `App.tsx`
- Check tenant slug pattern consistency

---

## Phase 4: Data Synchronization Audit (Pending)

### Cache Invalidation Issues
- Many mutations missing `queryClient.invalidateQueries`
- Some use hardcoded keys instead of `queryKeys` factory
- Need to verify cross-panel updates

---

## Phase 5: Form Handling Audit (Pending)

---

## Phase 6: API Integration Audit (Pending)

---

## Priority Fixes

### Critical (Fix First)
1. ProductManagement - Convert to TanStack Query
2. WholesaleClients - Add missing onClick handlers
3. Replace all hardcoded query keys with `queryKeys` factory

### High Priority
4. Add missing cache invalidation in mutations
5. Verify all button onClick handlers
6. Fix route mismatches

### Medium Priority
7. Form validation improvements
8. Loading state improvements
9. Error handling standardization

---

## Fixes Completed ✅

### 1. WholesaleClients.tsx ✅ COMPLETE
- ✅ Added onClick handler for "New Client" button → Opens CreateClientDialog
- ✅ Added onClick handler for "Import" button → Shows toast notification
- ✅ Replaced hardcoded query key with `queryKeys.wholesaleClients.list({ filter })`
- ✅ Fixed phone button to actually call client (`tel:` link)
- ✅ Created `CreateClientDialog.tsx` component with proper cache invalidation
- ✅ Added `useTenantAdminAuth` for tenant context

### 2. Query Keys Factory Extended ✅
Added missing query key definitions to `queryKeys.ts`:
- ✅ `categories` - For category management
- ✅ `productImages` - For product image management
- ✅ `pricing` - For pricing management
- ✅ `runners` - For runner/delivery management
- ✅ `pos` - For POS/cash register

### 3. AdminPricingPage.tsx ✅ COMPLETE
- ✅ Replaced hardcoded `['products-pricing']` with `queryKeys.pricing.products(tenantId)`
- ✅ Updated cache invalidation to use queryKeys factory
- ✅ Added invalidation for both pricing and products queries

### 4. CategoriesPage.tsx ✅ COMPLETE
- ✅ Replaced hardcoded `['categories']` with `queryKeys.categories.list(tenantId)`
- ✅ Updated all 3 cache invalidation calls to use `queryKeys.categories.lists()`

### 5. ImagesPage.tsx ✅ COMPLETE
- ✅ Replaced `['product-images']` with `queryKeys.productImages.list(tenantId)`
- ✅ Replaced `['products-for-images']` with `queryKeys.products.list({ tenantId, forImages: true })`
- ✅ Updated cache invalidation to invalidate both productImages and products queries

### 6. CashRegister.tsx ✅ COMPLETE
- ✅ Replaced `['pos-products']` with `queryKeys.pos.products(tenantId)`
- ✅ Replaced `['cash-register-transactions']` with `queryKeys.pos.transactions(tenantId)`
- ✅ Updated cache invalidation to include products list invalidation

### 7. FleetManagement.tsx ✅ COMPLETE
- ✅ Replaced `["active-deliveries"]` with `queryKeys.deliveries.active()`
- ✅ Replaced `["runners"]` with `queryKeys.runners.lists()`

### 8. RunnerLocationTracking.tsx ✅ COMPLETE
- ✅ Replaced `['wholesale-runners']` with `queryKeys.runners.list({ tenantId })`
- ✅ Replaced `['runner-deliveries']` with `queryKeys.runners.deliveries(runnerId)`

### 9. BatchesPage.tsx ✅ COMPLETE
- ✅ Replaced `['inventory-batches']` with `queryKeys.batches.list(tenantId)`
- ✅ Replaced `['products']` with `queryKeys.products.list({ tenantId })`
- ✅ Updated cache invalidation to include inventory queries

### 10. WarehousesPage.tsx ✅ COMPLETE
- ✅ Replaced `['warehouses']` with `queryKeys.warehouses.list(tenantId)`
- ✅ Updated cache invalidation to include inventory queries

### 11. ReceivingPage.tsx ✅ COMPLETE
- ✅ Replaced `['receiving']` with `queryKeys.receiving.list(tenantId, filter)`
- ✅ Updated cache invalidation to include inventory queries

## Remaining Work

### High Priority
1. **ProductManagement.tsx** - Convert from manual state to TanStack Query
   - Currently uses manual `loadProducts()` function
   - Should use `useQuery` with `queryKeys.products.list()`
   - Needs cache invalidation after mutations

### Medium Priority
6. Audit remaining 90+ admin pages for:
   - Missing onClick handlers
   - Hardcoded query keys
   - Missing cache invalidation
   - Route mismatches
   - Form validation issues

### Testing Checklist Needed
- [ ] Test "New Client" button creates client and refreshes list
- [ ] Test "Import" button shows toast
- [ ] Test phone button calls client
- [ ] Verify cache invalidation works after mutations
- [ ] Test cross-panel data synchronization

