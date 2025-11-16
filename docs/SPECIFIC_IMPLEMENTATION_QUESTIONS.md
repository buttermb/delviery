# Specific Implementation Questions - Buttons, Maps & Critical Features

## Date: 2025-01-15
## Purpose: Ensure all buttons, maps, and interactions work correctly

---

## 🎯 BUTTON & EVENT HANDLER QUESTIONS

### 1. **Order Status Update Buttons**
**Question:** When an admin clicks "Accept Order", "Mark as Preparing", "Out for Delivery", or "Delivered" buttons in the Orders page:
- Does it call the `update-order-status` edge function?
- Does it show a loading spinner while processing?
- Does it disable the button during the API call?
- Does it show a success toast and refresh the order list?
- Does it handle errors gracefully with user-friendly messages?

**Current Implementation Check Needed:**
- [ ] Verify button handlers in `src/pages/admin/Orders.tsx`
- [ ] Check if `useMutation` is used with proper loading states
- [ ] Verify toast notifications are shown

---

### 2. **Product Creation/Edit Form Submit**
**Question:** When clicking "Save Product" in the Product Management page:
- Does it validate all required fields before submission?
- Does it show "Generating SKU..." or "Saving..." during the process?
- Does it disable the submit button while processing?
- Does it handle barcode generation failures gracefully?
- Does it redirect or close the dialog on success?

**Current Implementation Check Needed:**
- [ ] Verify `handleSubmit` in `src/pages/admin/ProductManagement.tsx`
- [ ] Check loading state management
- [ ] Verify error handling for barcode generation

---

### 3. **Delete Buttons (Products, Orders, etc.)**
**Question:** When clicking any "Delete" button:
- Does it show a confirmation dialog first?
- Does it require typing "DELETE" or similar confirmation?
- Does it show a loading state during deletion?
- Does it refresh the list after successful deletion?
- Does it handle cascade deletions (e.g., deleting product removes from menus)?

**Current Implementation Check Needed:**
- [ ] Check if confirmation dialogs exist
- [ ] Verify deletion mutations handle cascades
- [ ] Check if list refreshes after deletion

---

### 4. **Bulk Action Buttons**
**Question:** When selecting multiple items and clicking "Bulk Delete" or "Bulk Update":
- Does it show how many items are selected?
- Does it require confirmation before bulk operations?
- Does it process items sequentially or in parallel?
- Does it show progress (e.g., "Deleting 3 of 10...")?
- Does it handle partial failures gracefully?

**Current Implementation Check Needed:**
- [ ] Check `src/components/admin/BulkActions.tsx`
- [ ] Verify bulk operation logic
- [ ] Check error handling for partial failures

---

### 5. **Menu Generation/Burn Buttons**
**Question:** When clicking "Generate Menu" or "Burn Menu":
- Does it show a loading state?
- Does it disable the button during processing?
- Does it show success/error toasts?
- Does it refresh the menu list after generation?
- Does it handle encryption/decryption errors?

**Current Implementation Check Needed:**
- [ ] Check menu generation handlers
- [ ] Verify loading states
- [ ] Check error handling

---

## 🗺️ MAP & LOCATION QUESTIONS

### 6. **Courier Location Tracking**
**Question:** How does the courier location map work?
- Does it update in real-time using Supabase Realtime subscriptions?
- How often does it poll/update courier positions (every 5 seconds? 10 seconds?)?
- Does it show courier markers with names/IDs?
- Does it handle GPS accuracy/errors (shows accuracy radius)?
- Does it stop updating when courier goes offline?

**Current Implementation Check Needed:**
- [ ] Check courier location components
- [ ] Verify Realtime subscriptions
- [ ] Check update frequency

---

### 7. **Route Planning/Replay**
**Question:** When viewing "Route Replay" for a delivery:
- Does it show the full route path (polyline)?
- Does it animate the courier movement along the route?
- Does it show waypoints (pickup, dropoff locations)?
- Does it show timestamps at each point?
- Does it handle missing location data gracefully?

**Current Implementation Check Needed:**
- [ ] Check `src/components/admin/maps/RouteReplayMap.tsx`
- [ ] Verify route calculation logic
- [ ] Check animation/playback controls

---

### 8. **Order Location on Map**
**Question:** When viewing orders on a map:
- Does it show all pending orders as markers?
- Does it show order status with different colors (pending=red, in-transit=yellow, delivered=green)?
- Does clicking a marker show order details in a popup?
- Does it auto-center/zoom to show all orders?
- Does it filter orders by status/date range?

**Current Implementation Check Needed:**
- [ ] Check order map components
- [ ] Verify marker clustering for many orders
- [ ] Check filter functionality

---

### 9. **Delivery Zone Visualization**
**Question:** Does the map show delivery zones/boroughs?
- Are borough boundaries drawn on the map?
- Are risk zones (green/yellow/red) color-coded?
- Can admins see which orders are in which zones?
- Does it show delivery radius for each zone?

**Current Implementation Check Needed:**
- [ ] Check if zone boundaries are implemented
- [ ] Verify risk zone visualization
- [ ] Check zone filtering

---

### 10. **Courier Assignment to Orders**
**Question:** When assigning a courier to an order via map:
- Can you drag an order marker to a courier marker?
- Or is it a click-to-select then assign workflow?
- Does it show courier's current location when assigning?
- Does it calculate estimated delivery time based on distance?
- Does it update the map immediately after assignment?

**Current Implementation Check Needed:**
- [ ] Check courier assignment UI
- [ ] Verify drag-and-drop or click workflow
- [ ] Check ETA calculation

---

## 🔄 DATA SYNC & REAL-TIME QUESTIONS

### 11. **Real-Time Order Updates**
**Question:** When an order status changes:
- Do all open admin dashboards update automatically?
- Does the customer's order page update in real-time?
- Does the courier's assigned orders list update?
- Is there a visual indicator (badge, animation) when status changes?
- Does it handle connection drops gracefully (reconnect automatically)?

**Current Implementation Check Needed:**
- [ ] Check Realtime subscriptions in order components
- [ ] Verify TanStack Query invalidation
- [ ] Check reconnection logic

---

### 12. **Inventory Updates**
**Question:** When inventory changes (product added, stock updated, order placed):
- Do product lists refresh automatically?
- Do menu visibility updates happen instantly?
- Do low-stock alerts appear immediately?
- Does it show a notification/toast when stock reaches zero?
- Does it handle concurrent updates (race conditions)?

**Current Implementation Check Needed:**
- [ ] Check inventory Realtime subscriptions
- [ ] Verify menu sync triggers
- [ ] Check concurrent update handling

---

## 📱 UI/UX INTERACTION QUESTIONS

### 13. **Form Validation & Error Display**
**Question:** When filling out forms (product creation, order creation, etc.):
- Are validation errors shown inline (below each field)?
- Do errors appear on blur or only on submit?
- Are required fields clearly marked (asterisk, red border)?
- Do error messages use user-friendly language (not technical)?
- Does the form prevent submission if there are errors?

**Current Implementation Check Needed:**
- [ ] Check form validation in all forms
- [ ] Verify error message clarity
- [ ] Check React Hook Form integration

---

### 14. **Search & Filter Functionality**
**Question:** When using search/filter in tables (products, orders, customers):
- Does it search as you type (debounced) or only on Enter?
- Does it highlight matching text in results?
- Does it preserve filters when navigating away and back?
- Does it show "No results" message when nothing matches?
- Does it clear filters with a "Clear All" button?

**Current Implementation Check Needed:**
- [ ] Check search implementation in table components
- [ ] Verify debouncing
- [ ] Check filter persistence

---

### 15. **Pagination & Infinite Scroll**
**Question:** For large lists (orders, products, customers):
- Does it use pagination (page 1, 2, 3...) or infinite scroll?
- How many items per page (10, 25, 50, 100)?
- Does it show "Loading more..." when fetching next page?
- Does it remember the current page when navigating away?
- Does it handle empty states (no items found)?

**Current Implementation Check Needed:**
- [ ] Check pagination implementation
- [ ] Verify page size options
- [ ] Check empty state handling

---

## 🔐 AUTHENTICATION & PERMISSIONS QUESTIONS

### 16. **Role-Based Button Visibility**
**Question:** Are buttons hidden/shown based on user roles?
- Do "owner" and "admin" see all buttons?
- Do "member" users see limited actions?
- Are delete buttons only visible to owners?
- Are subscription management buttons only for owners?
- Does it show "Upgrade Required" for locked features?

**Current Implementation Check Needed:**
- [ ] Check `PermissionGuard` usage
- [ ] Verify `usePermissions` hook
- [ ] Check feature gating

---

### 17. **Session Timeout Handling**
**Question:** When a user's session expires:
- Does it show a warning modal before timeout?
- Does it automatically log out when session expires?
- Does it save form data before logout?
- Does it redirect to login page?
- Does it show a message explaining why they were logged out?

**Current Implementation Check Needed:**
- [ ] Check `SessionTimeoutWarning` component
- [ ] Verify auto-logout logic
- [ ] Check form data persistence

---

## 💳 PAYMENT & ORDER QUESTIONS

### 18. **Order Payment Flow**
**Question:** When a customer places an order:
- Does it verify payment before creating the order?
- For cash orders, does it mark payment as "pending"?
- For card payments, does it show Stripe checkout or process inline?
- Does it show payment processing status (spinner, progress)?
- Does it handle payment failures gracefully (retry option)?

**Current Implementation Check Needed:**
- [ ] Check order creation flow
- [ ] Verify payment processing integration
- [ ] Check error handling

---

### 19. **Order Cancellation Flow**
**Question:** When cancelling an order:
- Does it require a reason/confirmation?
- Does it immediately restore inventory (via trigger)?
- Does it send notifications to customer and courier?
- Does it update payment status (refund if paid)?
- Does it show cancellation in order history?

**Current Implementation Check Needed:**
- [ ] Check cancellation handlers
- [ ] Verify inventory restoration trigger
- [ ] Check notification sending

---

## 🚨 ERROR HANDLING & EDGE CASES

### 20. **Network Error Handling**
**Question:** When network requests fail:
- Does it show user-friendly error messages (not "NetworkError: Failed to fetch")?
- Does it offer a "Retry" button for failed requests?
- Does it handle offline mode gracefully (queue actions for later)?
- Does it show connection status indicator?
- Does it prevent duplicate submissions if user clicks multiple times?

**Current Implementation Check Needed:**
- [ ] Check error message formatting
- [ ] Verify retry logic
- [ ] Check offline handling
- [ ] Verify request deduplication

---

## 📋 ADDITIONAL SPECIFIC QUESTIONS

### 21. **Barcode/Label Printing**
**Question:** When clicking "Print Label" on a product:
- Does it open a print dialog with the label preview?
- Is the label size correct (4" x 2")?
- Does it include barcode image and product details?
- Does it work on mobile devices?
- Does it handle print errors gracefully?

---

### 22. **Wholesale Order Creation**
**Question:** When creating a wholesale order:
- Does it validate credit limits before allowing order?
- Does it check inventory availability in real-time?
- Does it show bulk discount calculations?
- Does it prevent orders if client is over credit limit?
- Does it send order confirmation to client?

---

### 23. **Menu Access/Viewing**
**Question:** When a wholesale client views a disposable menu:
- Does it require authentication (PIN or token)?
- Does it track view count and enforce view limits?
- Does it show products that are out of stock as "Unavailable"?
- Does it handle menu expiration (show "Menu Expired")?
- Does it log all menu access attempts?

---

### 24. **Courier Earnings Display**
**Question:** When a courier views earnings:
- Does it show weekly/monthly totals?
- Does it break down by delivery?
- Does it show pending vs. paid earnings?
- Does it update in real-time as deliveries complete?
- Does it allow courier to request payout?

---

### 25. **Super Admin Tenant Management**
**Question:** When super admin manages tenants:
- Can they suspend/activate tenants with one click?
- Does it show tenant usage metrics in real-time?
- Can they impersonate a tenant and see their exact view?
- Does it log all super admin actions?
- Does it show tenant subscription status and billing info?

---

## ✅ VERIFICATION CHECKLIST

For each question above, verify:
- [ ] Button has loading state
- [ ] Button is disabled during async operations
- [ ] Error handling with try-catch
- [ ] User-friendly error messages
- [ ] Success toasts/notifications
- [ ] Proper logging (logger, not console.log)
- [ ] Tenant isolation (tenant_id filtering)
- [ ] Permission checks
- [ ] Real-time updates (if applicable)
- [ ] Mobile responsiveness

---

**Next Steps:**
1. Answer each question with current implementation status
2. Identify gaps or issues
3. Prioritize fixes based on user impact
4. Implement missing functionality

