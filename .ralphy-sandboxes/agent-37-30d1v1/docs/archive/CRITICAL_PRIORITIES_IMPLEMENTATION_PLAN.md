# Critical Priorities Implementation Plan

## Date: 2025-01-15
## Status: IN PROGRESS

---

## 🔴 PRIORITY 1: Authentication & RLS Verification

### Current Status
✅ **5 setSession() calls found** in `TenantAdminAuthContext.tsx`:
- Line 220: After login
- Line 354: After token verification
- Line 397: After token refresh
- Line 543: After token refresh
- Line 636: After token refresh

### Verification Checklist
- [x] TenantAdminAuthContext - All setSession() calls verified
- [ ] SuperAdminAuthContext - Verify setSession() calls
- [ ] CustomerAuthContext - Verify setSession() calls
- [ ] Test RLS policies with different roles
- [ ] Verify auth.uid() resolves correctly in RLS

### Action Items
1. Verify SuperAdminAuthContext has setSession() calls
2. Verify CustomerAuthContext has setSession() calls
3. Create test script to verify RLS with different roles
4. Document RLS policy coverage

---

## 🟡 PRIORITY 2: Feature Gating Implementation

### Current Status
✅ **FeatureProtectedRoute exists** - Uses `FeatureGate` component
⚠️ **FeatureGate needs verification** - Check upgrade modal implementation

### Implementation Checklist
- [x] FeatureProtectedRoute component exists
- [ ] FeatureGate shows upgrade modal
- [ ] Upgrade modal includes tier comparison
- [ ] Feature access properly gated by subscription tier
- [ ] UI shows "Upgrade to X" badges on locked features

### Action Items
1. Verify FeatureGate implementation
2. Add upgrade modal component if missing
3. Add tier comparison UI
4. Add "Upgrade" badges to locked features in sidebar
5. Test feature gating with different subscription tiers

---

## 🟡 PRIORITY 3: Real-time Sync Enhancement

### Current Status
✅ **Real-time hooks exist**:
- `useRealtimeOrders` - Orders real-time updates
- `useRealtimeSync` - Generic real-time sync
- `useRealtimePOS` - POS system real-time
- Multiple pages use real-time (RealtimeDashboard, LiveOrders, LiveMap, AdminLiveChat)

### Implementation Checklist
- [x] Real-time hooks exist
- [ ] Verify all critical tables have real-time enabled
- [ ] Add real-time to super admin analytics
- [ ] Add real-time to inventory updates
- [ ] Add real-time to subscription tier changes
- [ ] Add error handling and reconnection logic

### Action Items
1. Verify Supabase Realtime is enabled for critical tables
2. Add real-time subscription to super admin analytics
3. Add real-time for inventory updates (warehouse → tenant admin)
4. Add real-time notification for subscription tier changes
5. Enhance error handling in existing real-time hooks

---

## 🟢 PRIORITY 4: Audit Logging

### Current Status
⚠️ **Manual logging currently** - No database triggers found

### Implementation Checklist
- [ ] Create audit_trail table (if not exists)
- [ ] Create audit logging function
- [ ] Create triggers for critical tables:
  - products (INSERT, UPDATE, DELETE)
  - orders (INSERT, UPDATE, DELETE)
  - wholesale_orders (INSERT, UPDATE, DELETE)
  - tenants (UPDATE - subscription changes)
  - tenant_users (INSERT, UPDATE, DELETE)
- [ ] Add audit log viewer for super admin
- [ ] Add audit log filtering and search

### Action Items
1. Check if audit_trail table exists
2. Create audit logging function with SECURITY DEFINER
3. Create triggers for critical operations
4. Add audit log viewer component
5. Add audit log filtering UI

---

## 🟢 PRIORITY 5: Upgrade Modals

### Current Status
⚠️ **Not fully implemented** - FeatureGate may have basic implementation

### Implementation Checklist
- [ ] Create UpgradeModal component
- [ ] Add tier comparison table
- [ ] Add pricing information
- [ ] Add "Upgrade Now" CTA button
- [ ] Integrate with billing/subscription system
- [ ] Show upgrade modal when accessing locked feature

### Action Items
1. Check FeatureGate for existing upgrade modal
2. Create/Enhance UpgradeModal component
3. Add tier comparison UI
4. Add billing integration
5. Test upgrade flow

---

## Implementation Order

1. **Week 1: Authentication & RLS** (Critical)
   - Verify all setSession() calls
   - Test RLS policies
   - Document findings

2. **Week 1: Feature Gating** (High)
   - Verify FeatureGate
   - Add upgrade modals
   - Test feature access

3. **Week 2: Real-time Sync** (High)
   - Enhance existing hooks
   - Add missing subscriptions
   - Test real-time updates

4. **Week 2: Audit Logging** (Medium)
   - Create triggers
   - Add audit viewer
   - Test logging

5. **Week 3: Upgrade Modals** (Medium)
   - Create components
   - Integrate billing
   - Test upgrade flow

---

## Success Criteria

### Authentication & RLS
- ✅ All auth contexts sync with setSession()
- ✅ RLS policies work correctly for all roles
- ✅ auth.uid() resolves in all contexts

### Feature Gating
- ✅ All routes protected by FeatureProtectedRoute
- ✅ Upgrade modals show for locked features
- ✅ Tier comparison UI works

### Real-time Sync
- ✅ Critical tables have real-time enabled
- ✅ Super admin sees real-time updates
- ✅ Error handling and reconnection work

### Audit Logging
- ✅ All critical operations logged
- ✅ Audit log viewer functional
- ✅ Search and filtering work

### Upgrade Modals
- ✅ Modal shows on locked feature access
- ✅ Tier comparison accurate
- ✅ Upgrade flow works

---

**Next Steps:** Start with Priority 1 (Authentication & RLS Verification)

