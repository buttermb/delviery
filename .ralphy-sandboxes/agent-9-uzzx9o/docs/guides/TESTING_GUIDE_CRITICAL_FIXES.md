# Testing Guide - Critical Security & Database Fixes

## Overview
This guide provides step-by-step testing procedures for all 6 critical fixes implemented.

---

## 🔐 Priority 1: Role Permissions System

### Test 1: Permission Matrix Verification
```bash
# Check database permissions were seeded
psql -d your_database -c "SELECT COUNT(*) FROM permissions;"
# Expected: 50+ permissions

psql -d your_database -c "SELECT role, COUNT(*) FROM role_permissions GROUP BY role;"
# Expected: owner (all), admin (most), member (limited), viewer (read-only)
```

### Test 2: Permission Check Function
```sql
-- Test SQL function
SELECT has_permission('owner', 'orders:create');  -- Should return true
SELECT has_permission('viewer', 'orders:create'); -- Should return false
SELECT has_permission('admin', 'settings:edit'); -- Should return false
SELECT has_permission('admin', 'orders:create'); -- Should return true
```

### Test 3: Frontend Permission Guard
1. **Login as different roles** (owner, admin, team_member, viewer)
2. **Navigate to admin panel**
3. **Verify UI elements**:
   - Owner: All buttons/actions visible
   - Admin: Most actions visible, settings restricted
   - Team Member: Limited actions (orders, inventory view/edit)
   - Viewer: Read-only, no create/edit buttons

### Test 4: usePermissions Hook
```typescript
// In browser console on admin page
const { role, checkPermission } = usePermissions();
console.log('Role:', role);
console.log('Can create orders:', checkPermission('orders:create'));
console.log('Can edit settings:', checkPermission('settings:edit'));
```

---

## 📧 Priority 2: Email Verification for Invitations

### Test 1: Invitation Email Sending
1. **Login as tenant admin**
2. **Navigate to Team Management** (`/:tenantSlug/admin/team`)
3. **Click "Invite Member"**
4. **Fill form**:
   - Email: `test@example.com`
   - Role: `admin`
5. **Submit invitation**
6. **Check**:
   - ✅ Invitation created in database
   - ✅ Email sent (check Klaviyo logs or email service)
   - ✅ Email contains correct tenant name, role, invite link
   - ✅ Expiration date shown (7 days from now)

### Test 2: Email Template Rendering
1. **Check email in inbox** (or email service dashboard)
2. **Verify**:
   - ✅ HTML email renders correctly
   - ✅ Tenant branding displayed
   - ✅ Role shown correctly (Administrator, not "admin")
   - ✅ Invite link is clickable and correct format
   - ✅ Expiration date visible
   - ✅ Plain text version available

### Test 3: Email Failure Handling
1. **Temporarily break email service** (wrong API key)
2. **Send invitation**
3. **Verify**:
   - ✅ Invitation still created successfully
   - ✅ Error logged but doesn't block invitation
   - ✅ User sees success message

### Test 4: Invitation Acceptance
1. **Click invite link from email**
2. **Verify**:
   - ✅ Link works correctly
   - ✅ User can accept invitation
   - ✅ User account created with correct role

---

## 👥 Priority 3: User Limit Enforcement

### Test 1: Backend Limit Check
1. **Set tenant limit to 2 users** (via database or admin panel)
2. **Ensure 2 active users exist**
3. **Try to invite 3rd user**
4. **Verify**:
   - ✅ HTTP 403 error returned
   - ✅ Error message: "User limit reached"
   - ✅ Response includes: current_users, limit, upgrade_required

### Test 2: Enterprise Plan Bypass
1. **Set tenant to Enterprise plan**
2. **Invite multiple users** (beyond normal limit)
3. **Verify**:
   - ✅ No limit check performed
   - ✅ Invitations succeed

### Test 3: UI Feedback
1. **Login as tenant admin**
2. **Navigate to Team Management**
3. **Verify**:
   - ✅ Shows "X/Y users" in subtitle
   - ✅ When limit reached: "User limit reached" warning shown
   - ✅ Invite button disabled when limit reached
   - ✅ Upgrade message displayed

### Test 4: Active User Counting
1. **Create users with different statuses**:
   - 2 active users
   - 1 pending user
   - 1 suspended user
2. **Set limit to 2**
3. **Try to invite new user**
4. **Verify**:
   - ✅ Only counts active users (2)
   - ✅ Invitation blocked correctly

---

## 🔒 Priority 4: Cross-Table Email Check

### Test 1: Customer Signup with Staff Email
1. **Create tenant user** with email `test@example.com`
2. **Try to sign up as customer** with same email
3. **Verify**:
   - ✅ HTTP 409 error
   - ✅ Error: "This email is registered as a staff account"
   - ✅ Message includes correct login URL: `/{slug}/admin/login`

### Test 2: Tenant Signup with Customer Email
1. **Create customer user** with email `customer@example.com`
2. **Try to create tenant** with same email
3. **Verify**:
   - ✅ HTTP 400 error
   - ✅ Error: "This email is registered as a customer account"
   - ✅ Suggests using customer login or different email

### Test 3: Team Invitation with Customer Email
1. **Create customer user** with email `customer@example.com`
2. **Try to invite as team member** with same email
3. **Verify**:
   - ✅ HTTP 400 error
   - ✅ Error: "This email is registered as a customer account"
   - ✅ Suggests using customer login or different email

### Test 4: Normal Flow (No Conflicts)
1. **Use unique email** for each user type
2. **Verify**:
   - ✅ Customer signup works
   - ✅ Tenant signup works
   - ✅ Team invitation works

---

## 📝 Priority 5: Audit Logging for Impersonation

### Test 1: Impersonation Logging
1. **Login as super admin**
2. **Impersonate a tenant admin**
3. **Check audit_logs table**:
```sql
SELECT * FROM audit_logs 
WHERE action = 'impersonate_started' 
ORDER BY created_at DESC 
LIMIT 1;
```
4. **Verify**:
   - ✅ Record created with correct actor_id (super admin)
   - ✅ actor_type = 'super_admin'
   - ✅ action = 'impersonate_started'
   - ✅ resource_type = 'tenant'
   - ✅ changes JSONB contains: tenant_slug, tenant_name, admin_email, admin_id, admin_role
   - ✅ ip_address populated
   - ✅ user_agent populated

### Test 2: Logging Failure Handling
1. **Temporarily break audit_logs table** (rename or drop)
2. **Impersonate tenant**
3. **Verify**:
   - ✅ Impersonation still works
   - ✅ Error logged to console
   - ✅ No exception thrown

### Test 3: Multiple Impersonations
1. **Impersonate multiple tenants**
2. **Check audit logs**:
```sql
SELECT COUNT(*) FROM audit_logs WHERE action = 'impersonate_started';
```
3. **Verify**:
   - ✅ Each impersonation logged separately
   - ✅ All have unique timestamps
   - ✅ Correct tenant info for each

---

## 🔗 Priority 6: Slug Generation Fallback

### Test 1: Normal Slug Generation
1. **Create tenant** with unique business name: "My Business"
2. **Verify**:
   - ✅ Slug generated: "my-business"
   - ✅ No UUID suffix needed

### Test 2: Collision Handling
1. **Create tenant**: "Test Business" (slug: "test-business")
2. **Create another tenant**: "Test Business" (should get: "test-business-{timestamp}")
3. **Verify**:
   - ✅ Second tenant gets unique slug
   - ✅ No error thrown

### Test 3: UUID Fallback (10+ Collisions)
1. **Manually create 10+ tenants** with same business name pattern
2. **Create 11th tenant** with same name
3. **Verify**:
   - ✅ After 10 attempts, UUID fallback used
   - ✅ Slug format: `{base-slug}-{8-char-uuid}`
   - ✅ Warning logged to console
   - ✅ Signup succeeds (no 500 error)

### Test 4: Fallback Monitoring
1. **Check logs** for fallback usage
2. **Verify**:
   - ✅ Warning includes: business_name, original_slug, final_slug, attempts
   - ✅ Can track how often fallback is needed

---

## 🗄️ Database Constraints Migration

### Test 1: Foreign Key Verification
```sql
-- Check foreign keys were created
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
-- Expected: 50+ foreign keys
```

### Test 2: Unique Constraints Verification
```sql
-- Check unique constraints
SELECT table_name, constraint_name
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE'
  AND table_schema = 'public'
  AND constraint_name LIKE 'uq_%';
-- Expected: tenants_slug, tenant_users_email_tenant, etc.
```

### Test 3: Check Constraints Verification
```sql
-- Check constraints
SELECT table_name, constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public';
-- Expected: tenant_users_role_check, tenants_subscription_plan_check, etc.
```

### Test 4: Referential Integrity Test
```sql
-- Try to create orphaned record (should fail)
INSERT INTO orders (tenant_id, user_id, status) 
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'pending');
-- Expected: Foreign key violation error
```

### Test 5: Unique Constraint Test
```sql
-- Try to create duplicate tenant slug (should fail)
INSERT INTO tenants (business_name, slug, owner_email, owner_name, subscription_plan, subscription_status)
VALUES ('Test', 'existing-slug', 'test@test.com', 'Test', 'starter', 'trial');
-- Expected: Unique constraint violation error
```

### Test 6: Check Constraint Test
```sql
-- Try to insert invalid role (should fail)
INSERT INTO tenant_users (tenant_id, email, name, role, status)
VALUES ('{valid-tenant-id}', 'test@test.com', 'Test', 'invalid_role', 'active');
-- Expected: Check constraint violation error
```

---

## 🔄 Integration Testing

### Test 1: Complete Invitation Flow
1. **Login as tenant admin**
2. **Invite team member** (with permission check)
3. **Verify email sent**
4. **Accept invitation**
5. **Login as new team member**
6. **Verify permissions** (should match role)
7. **Try restricted action** (should be blocked)

### Test 2: User Limit + Invitation Flow
1. **Set user limit to 1**
2. **Ensure 1 active user exists**
3. **Try to invite 2nd user**
4. **Verify**:
   - ✅ Invitation blocked
   - ✅ UI shows limit reached
   - ✅ Error message clear

### Test 3: Cross-Table Check + Invitation
1. **Create customer** with email `test@example.com`
2. **Try to invite as team member** with same email
3. **Verify**:
   - ✅ Invitation blocked
   - ✅ Clear error message
   - ✅ Suggests customer login

### Test 4: Permission + Limit + Email
1. **Login as viewer** (read-only role)
2. **Try to invite team member**
3. **Verify**:
   - ✅ Permission check blocks action
   - ✅ UI hides invite button (if PermissionGuard used)

---

## 🐛 Edge Cases to Test

### Edge Case 1: Rapid Invitations
- Send 10 invitations quickly
- Verify all emails sent
- Verify no race conditions

### Edge Case 2: Expired Invitation
- Create invitation
- Wait for expiration (or manually expire)
- Try to accept
- Verify proper error handling

### Edge Case 3: Tenant Deletion
- Create tenant with users/orders
- Delete tenant
- Verify cascade deletes work (foreign keys)
- Verify orphaned data cleaned up

### Edge Case 4: Role Change During Session
- Login as admin
- Change role to viewer (in another session)
- Try restricted action
- Verify permission check updates

### Edge Case 5: Email Service Down
- Break email service
- Send invitation
- Verify invitation still created
- Verify error logged
- Fix email service
- Verify can resend invitation

---

## 📊 Performance Testing

### Test 1: Permission Check Performance
```sql
-- Time permission checks
EXPLAIN ANALYZE
SELECT has_permission('admin', 'orders:create');
-- Should be fast (< 1ms)
```

### Test 2: User Limit Check Performance
- Test with 1000+ users
- Verify limit check is fast
- Check query uses index

### Test 3: Email Sending Performance
- Send 100 invitations
- Verify all emails sent
- Check for rate limiting issues

---

## ✅ Acceptance Criteria

All tests should pass:
- [x] Permission system works for all roles
- [x] Invitation emails sent successfully
- [x] User limits enforced correctly
- [x] Cross-table checks prevent conflicts
- [x] Audit logs capture impersonation
- [x] Slug generation always succeeds
- [x] Foreign keys prevent orphaned records
- [x] Unique constraints prevent duplicates
- [x] Check constraints validate enums
- [x] UI feedback is clear and helpful

---

## 🚨 Known Issues / Limitations

1. **Email Service Dependency**: Requires Klaviyo or similar service configured
2. **Permission Caching**: Permissions cached for 5 minutes (may need manual refresh)
3. **Audit Log Retention**: Logs kept for 1 year (configurable)
4. **Slug Fallback**: UUID suffix makes slugs less readable (acceptable trade-off)

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Priority 1 - Role Permissions: [ ] Pass [ ] Fail
Priority 2 - Email Invitations: [ ] Pass [ ] Fail
Priority 3 - User Limits: [ ] Pass [ ] Fail
Priority 4 - Cross-Table Checks: [ ] Pass [ ] Fail
Priority 5 - Audit Logging: [ ] Pass [ ] Fail
Priority 6 - Slug Fallback: [ ] Pass [ ] Fail
Database Constraints: [ ] Pass [ ] Fail

Notes:
_______________________________________
_______________________________________
```

