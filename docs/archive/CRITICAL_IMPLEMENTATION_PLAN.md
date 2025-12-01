# Critical Implementation Plan

## Date: 2025-01-15
## Based on: Answers to Clarifying Questions

---

## 🔴 CRITICAL PRIORITIES (Before Production)

### 1. Payment Processing Strategy ⚠️
**Status:** NEEDS DECISION + IMPLEMENTATION

**Decision Required:**
- [ ] Enable Stripe for card payments?
- [ ] Keep cash-on-delivery only?
- [ ] Add crypto payment processor?

**Implementation Tasks:**
- [ ] Verify payment before order confirmation
- [ ] Implement retry logic for card failures
- [ ] Send notifications to customer/admin on payment failure
- [ ] Add payment status tracking in orders table
- [ ] Create payment failure handling workflow

**Estimated Time:** 2-3 days

---

### 2. GDPR Compliance Endpoints ⚠️
**Status:** NEEDS IMPLEMENTATION

**Required Endpoints:**
- [ ] `GET /api/gdpr/export` - Export all user data
- [ ] `DELETE /api/gdpr/erase` - Delete all user data
- [ ] `GET /api/gdpr/portability` - Export data in portable format

**Implementation Tasks:**
- [ ] Create `gdpr-export` edge function
- [ ] Create `gdpr-erase` edge function
- [ ] Create `gdpr-portability` edge function
- [ ] Add data export UI in customer portal
- [ ] Add data deletion request UI
- [ ] Implement data anonymization for legal retention
- [ ] Add audit logging for GDPR requests

**Estimated Time:** 3-4 days

---

### 3. Data Retention Policies ⚠️
**Status:** NEEDS IMPLEMENTATION

**Implementation Tasks:**
- [ ] Create retention policy migration
- [ ] Implement 7-year retention for tax/legal data
- [ ] Auto-delete old location history (30 days - already implemented)
- [ ] Auto-archive old orders (keep summary, delete details)
- [ ] Create data cleanup cron job
- [ ] Add retention policy documentation

**Estimated Time:** 2 days

---

### 4. Proper Rate Limiting (Redis) ⚠️
**Status:** NEEDS IMPLEMENTATION

**Implementation Tasks:**
- [ ] Set up Upstash Redis (or similar)
- [ ] Create rate limiting utility in `_shared/validation.ts`
- [ ] Apply rate limits to:
  - Login attempts (5 per minute)
  - API calls (100 per minute per tenant)
  - Order creation (10 per minute per customer)
  - Password reset (3 per hour)
- [ ] Add rate limit headers to responses
- [ ] Create rate limit monitoring dashboard

**Estimated Time:** 2-3 days

---

### 5. Inventory Restoration on Order Cancel ⚠️
**Status:** NEEDS VERIFICATION + IMPLEMENTATION

**Implementation Tasks:**
- [ ] Verify current implementation
- [ ] Create `restore_order_inventory()` function if missing
- [ ] Create trigger: `restore_inventory_on_cancel`
- [ ] Test inventory restoration
- [ ] Add audit log entry for restoration
- [ ] Handle partial cancellations (order items)

**Estimated Time:** 1 day

---

## 🟡 HIGH PRIORITIES (Soon After Launch)

### 6. Real-time Subscriptions for Order Updates ⚠️
**Status:** PARTIAL - NEEDS ENHANCEMENT

**Implementation Tasks:**
- [ ] Add real-time subscription to customer order page
- [ ] Add real-time subscription to courier dashboard
- [ ] Add real-time subscription to admin order management
- [ ] Handle connection errors gracefully
- [ ] Add reconnection logic
- [ ] Test with multiple concurrent users

**Estimated Time:** 2 days

---

### 7. Push Notification System ⚠️
**Status:** NOT IMPLEMENTED

**Implementation Tasks:**
- [ ] Set up FCM (Firebase Cloud Messaging)
- [ ] Create notification service edge function
- [ ] Add push notification subscription UI
- [ ] Send notifications for:
  - Order status changes
  - New orders (courier)
  - Payment failures
  - Inventory alerts
- [ ] Add notification preferences UI
- [ ] Test on iOS and Android

**Estimated Time:** 3-4 days

---

### 8. Super Admin Impersonation ⚠️
**Status:** UI EXISTS, EDGE FUNCTION NEEDED

**Implementation Tasks:**
- [ ] Create `impersonate-tenant` edge function
- [ ] Generate temporary tenant admin token
- [ ] Add impersonation session tracking
- [ ] Add audit log entry for impersonation
- [ ] Add "Exit Impersonation" button
- [ ] Test impersonation flow

**Estimated Time:** 1-2 days

---

### 9. Tenant Suspension Enforcement ⚠️
**Status:** PARTIAL - NEEDS ENHANCEMENT

**Implementation Tasks:**
- [ ] Update RLS policies to check tenant status
- [ ] Block API access for suspended tenants
- [ ] Show suspension message in UI
- [ ] Allow data export for suspended tenants
- [ ] Add suspension reason tracking
- [ ] Test suspension workflow

**Estimated Time:** 1 day

---

## 📅 RECOMMENDED IMPLEMENTATION ORDER

### Week 1: Critical Items
1. **Day 1-2:** Payment processing decision + implementation
2. **Day 3-4:** GDPR compliance endpoints
3. **Day 5:** Data retention policies

### Week 2: Critical + High Priority
4. **Day 1:** Inventory restoration verification
5. **Day 2-3:** Rate limiting (Redis)
6. **Day 4-5:** Real-time subscriptions enhancement

### Week 3: High Priority
7. **Day 1-3:** Push notification system
8. **Day 4:** Super admin impersonation
9. **Day 5:** Tenant suspension enforcement

---

## 🎯 QUICK WINS (Can Do Immediately)

1. **Inventory Restoration Verification** (1 day)
   - Quick to verify and fix if needed
   - High impact for order management

2. **Tenant Suspension Enforcement** (1 day)
   - Quick RLS policy updates
   - Important for security

3. **Super Admin Impersonation** (1-2 days)
   - Edge function already partially designed
   - High value for support

---

## 📝 DECISION REQUIRED

**Payment Processing Strategy:**
- [ ] Option A: Stripe only (card payments)
- [ ] Option B: Cash-on-delivery only
- [ ] Option C: Stripe + Cash-on-delivery
- [ ] Option D: Stripe + Cash + Crypto

**Please confirm your choice so I can implement accordingly.**

---

**Status:** Ready to implement based on your priorities

