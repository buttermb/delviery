# FloraIQ Testing Checklist

## Pre-Testing Setup
- [ ] Verify development server is running (`npm run dev`)
- [ ] Verify Supabase connection is healthy
- [ ] Clear browser cache/localStorage if needed

---

## 1. Authentication Flows

### 1.1 Tenant Admin Login
- [ ] Navigate to `/{tenant-slug}/admin/login`
- [ ] Enter valid credentials
- [ ] Verify redirect to dashboard
- [ ] Verify user name displays in header
- [ ] Verify sidebar navigation loads correctly

### 1.2 Tenant Admin Signup
- [ ] Navigate to `/signup`
- [ ] Fill in all required fields
- [ ] Verify CAPTCHA (if enabled)
- [ ] Submit form
- [ ] Verify auto-login (no page reload)
- [ ] Verify redirect to dashboard with welcome message
- [ ] Verify initial credits granted

### 1.3 Session Management
- [ ] Close browser, reopen
- [ ] Verify session persists (httpOnly cookies)
- [ ] Click logout
- [ ] Verify redirect to login page
- [ ] Verify cannot access dashboard without logging in

### 1.4 Super Admin Login
- [ ] Navigate to `/super-admin/login`
- [ ] Enter super admin credentials
- [ ] Verify dashboard loads with tenant management

---

## 2. Order Management

### 2.1 Create Order (Marketplace Storefront)
- [ ] Navigate to `/shop/{store-slug}`
- [ ] Browse products
- [ ] Add item to cart
- [ ] Proceed to checkout
- [ ] Enter customer details
- [ ] Apply coupon (if applicable)
- [ ] Submit order
- [ ] Verify order confirmation page

### 2.2 Order Status Updates
- [ ] Login as admin
- [ ] Navigate to Orders page
- [ ] Find new order
- [ ] Update status to "Confirmed"
- [ ] Verify status badge updates
- [ ] Continue through: Preparing → Ready → Out for Delivery → Delivered

### 2.3 Order Tracking (Customer)
- [ ] Use tracking link from confirmation page
- [ ] Verify order status displays correctly
- [ ] Verify tracking timeline updates

---

## 3. Inventory Management

### 3.1 Product Management
- [ ] Navigate to Inventory → Products
- [ ] Add new product with image
- [ ] Verify product appears in list
- [ ] Edit product details
- [ ] Verify changes persist

### 3.2 Stock Levels
- [ ] Navigate to Inventory Dashboard
- [ ] Verify stock counts display
- [ ] Update stock quantity
- [ ] Verify low stock alerts (if applicable)

---

## 4. Marketplace (B2C)

### 4.1 Store Settings
- [ ] Navigate to Marketplace → Dashboard
- [ ] Click Store Settings
- [ ] Update branding (logo, colors)
- [ ] Update policies
- [ ] Save changes
- [ ] Verify changes reflect on storefront

### 4.2 Product Visibility
- [ ] Navigate to Product Visibility Manager
- [ ] Toggle product visibility
- [ ] Verify product appears/disappears on storefront

### 4.3 Coupons
- [ ] Navigate to Coupons page
- [ ] Create new coupon
- [ ] Test coupon on storefront checkout
- [ ] Verify discount applies correctly

---

## 5. Mobile App (Capacitor)

### 5.1 Build Verification
- [ ] Run `npm run build`
- [ ] Run `npx cap sync`
- [ ] Open Android Studio (`npx cap open android`)
- [ ] Verify app builds successfully

### 5.2 Push Notifications (requires device)
- [ ] Install app on Android device
- [ ] Grant notification permission
- [ ] Verify FCM token registered
- [ ] Trigger order status update
- [ ] Verify push notification received

---

## 6. Credit System

### 6.1 Credit Balance
- [ ] Verify credit balance displays in header
- [ ] Perform credit-consuming action
- [ ] Verify balance decrements
- [ ] Verify toast notification shows deduction

### 6.2 Low Credit Warning
- [ ] Reduce credits to low threshold
- [ ] Verify warning badge appears
- [ ] Click to view purchase options

---

## 7. Performance & SEO

### 7.1 Page Load
- [ ] Measure initial load time (< 3s target)
- [ ] Verify lazy loading works for routes
- [ ] Check Core Web Vitals (LCP, FID, CLS)

### 7.2 SEO
- [ ] Verify page titles update dynamically
- [ ] Check meta descriptions present
- [ ] Verify sitemap.xml generated

---

## Post-Testing Cleanup
- [ ] Document any bugs found
- [ ] Reset test data if needed
- [ ] Clear test accounts

---

## Test Results Summary

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Authentication | | | |
| Orders | | | |
| Inventory | | | |
| Marketplace | | | |
| Mobile | | | |
| Credits | | | |
| Performance | | | |

**Tested By:** _______________  
**Date:** _______________  
**Environment:** _______________
