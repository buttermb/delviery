# Admin Panel Testing Checklist

**Date:** 2025-01-28  
**Purpose:** Manual testing guide for all fixed functionality

---

## 🧪 Critical Flows to Test

### 1. WholesaleClients Page

#### Create New Client
- [ ] Navigate to `/admin/wholesale-clients`
- [ ] Click "New Client" button
- [ ] Dialog opens correctly
- [ ] Fill in required fields (Business Name, Contact Name, Phone)
- [ ] Click "Create Client"
- [ ] Success toast appears
- [ ] Dialog closes
- [ ] New client appears in list immediately
- [ ] No page refresh needed

#### Import Button
- [ ] Click "Import" button
- [ ] Toast notification appears with "coming soon" message
- [ ] No errors in console

#### Phone Button
- [ ] Click phone icon on any client row
- [ ] On mobile: Phone dialer opens with client's number
- [ ] On desktop: Shows error toast if no phone number
- [ ] No errors in console

#### Filter Buttons
- [ ] Click "All" filter → Shows all clients
- [ ] Click "Active" filter → Shows only active clients
- [ ] Click "Credit Approved" filter → Shows clients with credit
- [ ] Click "Overdue" filter → Shows overdue clients
- [ ] List updates correctly for each filter

---

### 2. AdminPricingPage

#### Update Product Pricing
- [ ] Navigate to `/admin/sales/pricing`
- [ ] Click edit icon on any product
- [ ] Update price fields
- [ ] Click save
- [ ] Success toast appears
- [ ] Price updates in table immediately
- [ ] Navigate to Products page → Price reflects there too (cross-panel sync)

---

### 3. CategoriesPage

#### Create Category
- [ ] Navigate to `/admin/catalog/categories`
- [ ] Click "Create Category"
- [ ] Fill form and submit
- [ ] Category appears in list immediately
- [ ] No page refresh needed

#### Update Category
- [ ] Click edit on existing category
- [ ] Make changes and save
- [ ] Changes appear immediately in list

#### Delete Category
- [ ] Click delete on category
- [ ] Confirm deletion
- [ ] Category removes from list immediately

---

### 4. ImagesPage

#### Upload Product Image
- [ ] Navigate to `/admin/catalog/images`
- [ ] Click "Upload Image"
- [ ] Select product from dropdown
- [ ] Upload image file
- [ ] Success toast appears
- [ ] Image appears in grid immediately
- [ ] Navigate to Products page → Product shows new image (cross-panel sync)

#### Delete Image
- [ ] Click delete on an image
- [ ] Confirm deletion
- [ ] Image removes from grid immediately
- [ ] Product image_url updates (check Products page)

---

### 5. CashRegister

#### Process Payment
- [ ] Navigate to `/admin/cash-register`
- [ ] Add products to cart
- [ ] Select payment method
- [ ] Click "Process Payment"
- [ ] Success toast appears
- [ ] Cart clears
- [ ] Transaction appears in recent transactions
- [ ] Product stock decreases (check Products page)

---

### 6. FleetManagement

#### View Active Deliveries
- [ ] Navigate to `/admin/fleet-management`
- [ ] Active deliveries load correctly
- [ ] Real-time updates work (if enabled)
- [ ] Runners list loads correctly

---

### 7. RunnerLocationTracking

#### Select Runner
- [ ] Navigate to `/admin/gps-tracking`
- [ ] Select runner from dropdown
- [ ] Runner's deliveries load
- [ ] Location history displays
- [ ] No errors in console

---

### 8. BatchesPage

#### Create Batch
- [ ] Navigate to `/admin/catalog/batches`
- [ ] Click "Create Batch"
- [ ] Fill form and submit
- [ ] Batch appears in list immediately
- [ ] Inventory updates (check Inventory page)

---

### 9. WarehousesPage

#### Add Warehouse
- [ ] Navigate to `/admin/locations/warehouses`
- [ ] Click "Add Warehouse"
- [ ] Fill form and submit
- [ ] Warehouse appears in list immediately
- [ ] Inventory grouped by warehouse updates

---

### 10. ReceivingPage

#### Create Receiving Record
- [ ] Navigate to `/admin/operations/receiving`
- [ ] Click "New Receipt"
- [ ] Fill form and submit
- [ ] Receipt appears in list immediately
- [ ] Filter by status works correctly

#### Update QC Status
- [ ] Click QC on a receipt
- [ ] Update QC status and notes
- [ ] Save changes
- [ ] Status updates in list immediately

---

## 🔍 General Testing

### Console Errors
- [ ] Open browser DevTools Console
- [ ] Navigate through all fixed pages
- [ ] No red errors appear
- [ ] No warnings about missing handlers
- [ ] No React warnings about keys

### Network Tab
- [ ] Open Network tab in DevTools
- [ ] Perform create/update/delete operations
- [ ] Verify API calls fire correctly
- [ ] Check response status codes (200, 201)
- [ ] Verify request payloads are correct

### React DevTools
- [ ] Install React DevTools extension
- [ ] Check component state updates
- [ ] Verify queries refetch after mutations
- [ ] Check cache invalidation works

### Cache Invalidation
- [ ] Create item in one panel
- [ ] Navigate to related panel
- [ ] Verify item appears without manual refresh
- [ ] Example: Create client → Check Financial Center shows client

### Cross-Panel Synchronization
- [ ] Update pricing → Check Products page
- [ ] Upload image → Check Products page
- [ ] Create batch → Check Inventory page
- [ ] Process payment → Check Products stock

---

## 🐛 Known Issues to Watch For

1. **ProductManagement** - Still uses manual state (not fixed yet)
2. **Some pages** - May still have hardcoded query keys (lower priority)

---

## ✅ Success Criteria

All tests should pass:
- ✅ No console errors
- ✅ All buttons work
- ✅ Data syncs across panels
- ✅ Cache invalidation works
- ✅ Loading states appear
- ✅ Error messages display correctly
- ✅ Success toasts appear
- ✅ Forms reset after submission

---

## 📝 Notes

- Test on both desktop and mobile if possible
- Test with slow network (throttle in DevTools)
- Test error scenarios (disconnect network, invalid data)
- Test with multiple browser tabs open (cache sync)

---

**Last Updated:** 2025-01-28

