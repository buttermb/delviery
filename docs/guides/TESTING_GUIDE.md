# Testing Guide

Complete testing guide for all new features and fixes.

## Pre-Testing Checklist

- [ ] All migrations applied
- [ ] All Edge Functions deployed
- [ ] Database is accessible
- [ ] Supabase Realtime is enabled
- [ ] Test tenant account created
- [ ] Test super admin account created

---

## Test 1: Authentication & Authorization

### Test Edge Function Authentication

**Steps**:
1. Login as tenant admin
2. Open browser DevTools → Network tab
3. Navigate to any page that uses Edge Functions
4. Check network requests

**Expected**:
- ✅ All Edge Function requests have `Authorization: Bearer <token>` header
- ✅ No 401 Unauthorized errors
- ✅ No 403 Forbidden errors
- ✅ Responses return 200 OK

**Test Commands**:
```bash
# Test billing Edge Function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/billing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_billing", "tenant_id": "YOUR_TENANT_ID"}'

# Should return: {"billing": {...}}
```

**Test Pages**:
- `/admin/billing` - Should load billing info
- `/admin/customers` - Should load customer data
- `/admin/invoices` - Should load invoices

---

## Test 2: JSON Coercion Fixes

### Test RPC Functions

**Steps**:
1. Connect to database
2. Run RPC functions directly

**Expected**:
- ✅ Functions return single JSON objects (not arrays)
- ✅ No coercion errors in console
- ✅ Data loads correctly

**Test SQL**:
```sql
-- Test billing RPC
SELECT get_tenant_billing('TENANT_ID_HERE');
-- Should return single JSON object

-- Test white label RPC
SELECT get_white_label_config('TENANT_ID_HERE');
-- Should return single JSON object

-- Test payment methods RPC
SELECT get_payment_methods('TENANT_ID_HERE');
-- Should return JSON array

-- Test invoice RPC
SELECT get_tenant_invoices('TENANT_ID_HERE');
-- Should return JSON array
```

**Test Pages**:
- `/admin/billing` - Billing info should load without errors
- `/admin/white-label` - White label config should load

---

## Test 3: Real-Time Synchronization

### Test POS System Real-Time

**Steps**:
1. Open POS System in two browser tabs (same tenant)
2. In Tab 1: Complete a sale
3. In Tab 2: Watch for automatic updates

**Expected**:
- ✅ Tab 2 updates automatically within 1-2 seconds
- ✅ Product inventory updates
- ✅ Cart clears automatically
- ✅ No page refresh needed

**Test Pages**:
- `/admin/pos` - Make sale, verify real-time updates
- `/admin/fleet-management` - Update delivery status, verify updates
- `/admin/inventory` - Update inventory, verify updates
- `/admin/financial-center` - Process payment, verify updates

**Verification**:
```typescript
// Check browser console for real-time messages
// Should see: "[useRealtimeSync] Realtime subscription active: orders"
```

---

## Test 4: Activity Logging

### Test Activity Log Creation

**Steps**:
1. Complete a sale in POS System
2. Check `activity_logs` table in database

**Expected**:
- ✅ Activity log entry created
- ✅ Contains correct user_id, tenant_id, action
- ✅ Metadata contains sale details

**Test SQL**:
```sql
-- Check recent activities
SELECT * FROM activity_logs 
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY created_at DESC 
LIMIT 10;

-- Should see entries like:
-- action: "update_inventory", "complete_order"
-- resource: "product", "pos_sale"
```

**Test Actions**:
- Complete sale in POS → Should log inventory update + order completion
- Create invoice → Should log invoice creation
- Update inventory → Should log inventory update

---

## Test 5: Invoice Management

### Test Invoice CRUD Operations

**Steps**:
1. Navigate to `/admin/customers/invoices`
2. Create new invoice
3. View invoice list
4. Update invoice
5. Delete draft invoice

**Expected**:
- ✅ Invoice created successfully
- ✅ Invoice appears in list
- ✅ Invoice can be updated
- ✅ Draft invoices can be deleted
- ✅ Non-draft invoices cannot be deleted

**Test Edge Function**:
```bash
# Create invoice
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/invoice-management \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "tenant_id": "YOUR_TENANT_ID",
    "invoice_data": {
      "subtotal": 100.00,
      "tax": 8.88,
      "total": 108.88,
      "line_items": [],
      "issue_date": "2025-01-01",
      "due_date": "2025-01-31",
      "status": "draft"
    }
  }'

# List invoices
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/invoice-management \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "list", "tenant_id": "YOUR_TENANT_ID"}'
```

---

## Test 6: Staff Management

### Test Staff CRUD Operations

**Steps**:
1. Navigate to staff management page (if exists)
2. Or use Edge Function directly
3. List staff members
4. Create staff member
5. Update staff member
6. Delete staff member

**Expected**:
- ✅ Staff list loads
- ✅ Staff can be created
- ✅ Staff can be updated
- ✅ Staff can be deleted (except self)

**Test Edge Function**:
```bash
# List staff
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/staff-management \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "list", "tenant_id": "YOUR_TENANT_ID"}'
```

---

## Test 7: Panic Reset Tool

### Test Panic Reset (SUPER ADMIN ONLY)

**⚠️ WARNING: Only test in development/test environment!**

**Steps**:
1. Login as super admin
2. Navigate to `/super-admin/tools`
3. Select test tenant
4. Click "Preview" button
5. Verify preview shows correct counts
6. **DO NOT click reset in production!**

**Expected**:
- ✅ Preview shows record counts
- ✅ Confirmation input required
- ✅ Reset only works with "CONFIRM_RESET"
- ✅ Reset logs to audit_logs

**Test Edge Function**:
```bash
# Preview (safe)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/panic-reset \
  -H "Authorization: Bearer SUPER_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "preview", "tenant_id": "TEST_TENANT_ID"}'

# Should return preview of what would be deleted
```

---

## Test 8: Billing Page Integration

### Test Billing Edge Function

**Steps**:
1. Navigate to `/tenant-admin/billing`
2. Check browser console for errors
3. Verify invoices load
4. Verify subscription info displays

**Expected**:
- ✅ No console errors
- ✅ Invoices load from Edge Function
- ✅ Fallback to direct query if Edge Function fails
- ✅ Billing info displays correctly

---

## Test 9: Error Handling

### Test Error Scenarios

**Test Cases**:

1. **Invalid Token**:
   - Use expired/invalid JWT token
   - Expected: 401 Unauthorized error

2. **Wrong Tenant**:
   - Try to access another tenant's data
   - Expected: 403 Forbidden error

3. **Missing Parameters**:
   - Call Edge Function without required params
   - Expected: 400 Bad Request with error message

4. **Network Error**:
   - Disconnect network during Edge Function call
   - Expected: Error toast, graceful fallback

**Test Commands**:
```bash
# Invalid token
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/billing \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_billing"}'
# Should return: {"error": "Unauthorized"}

# Missing tenant_id (should auto-detect, but test error case)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/billing \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_billing"}'
```

---

## Test 10: Performance

### Test Response Times

**Steps**:
1. Open browser DevTools → Network tab
2. Navigate through pages
3. Check response times

**Expected**:
- ✅ Edge Functions respond in < 2 seconds
- ✅ RPC functions execute in < 1 second
- ✅ Real-time updates appear within 1-2 seconds
- ✅ Page loads in < 3 seconds

**Benchmarks**:
- Edge Function: < 2000ms
- RPC Function: < 1000ms
- Real-time update: < 2000ms
- Page load: < 3000ms

---

## Test 11: RLS Policies

### Test Row Level Security

**Steps**:
1. Login as regular user
2. Try to access other tenant's data
3. Verify RLS policies prevent access

**Expected**:
- ✅ Users can only see their own data
- ✅ Tenant admins can see tenant data
- ✅ Super admins can see all data

**Test SQL**:
```sql
-- Test as regular user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'USER_ID';

-- Should only see own activities
SELECT * FROM activity_logs WHERE user_id = 'USER_ID';

-- Should NOT see other users' activities
SELECT * FROM activity_logs WHERE user_id != 'USER_ID';
-- Should return empty or error
```

---

## Test 12: Integration Tests

### Test Full Workflows

**Workflow 1: Complete Sale**
1. Open POS System
2. Add items to cart
3. Complete sale
4. Verify:
   - ✅ Inventory updated
   - ✅ Activity logged
   - ✅ Real-time sync works
   - ✅ No errors

**Workflow 2: Create Invoice**
1. Navigate to Customer Invoices
2. Create invoice
3. Verify:
   - ✅ Invoice created
   - ✅ Appears in list
   - ✅ Can be viewed
   - ✅ No errors

**Workflow 3: Real-Time Sync**
1. Open two browser tabs
2. Make changes in Tab 1
3. Verify Tab 2 updates automatically
4. Verify:
   - ✅ Updates appear within 1-2 seconds
   - ✅ No manual refresh needed
   - ✅ Data is consistent

---

## Common Issues & Solutions

### Issue: Edge Function returns 401
**Solution**: Check JWT token is valid and properly passed

### Issue: Real-time not working
**Solution**: 
- Check Supabase Realtime is enabled
- Verify channel subscriptions in console
- Check network connectivity

### Issue: JSON coercion error
**Solution**: 
- Verify RPC function exists
- Check RPC returns single JSON object
- Use Edge Function fallback

### Issue: Activity logs not appearing
**Solution**:
- Verify `activity_logs` table exists
- Check RLS policies allow inserts
- Verify `log_activity()` function exists

---

## Test Results Template

```
Test Date: _______________
Tester: _______________

✅ Test 1: Authentication - PASS / FAIL
✅ Test 2: JSON Coercion - PASS / FAIL
✅ Test 3: Real-Time Sync - PASS / FAIL
✅ Test 4: Activity Logging - PASS / FAIL
✅ Test 5: Invoice Management - PASS / FAIL
✅ Test 6: Staff Management - PASS / FAIL
✅ Test 7: Panic Reset - PASS / FAIL
✅ Test 8: Billing Integration - PASS / FAIL
✅ Test 9: Error Handling - PASS / FAIL
✅ Test 10: Performance - PASS / FAIL
✅ Test 11: RLS Policies - PASS / FAIL
✅ Test 12: Integration - PASS / FAIL

Notes:
_________________________________
_________________________________
```

---

## Success Criteria

All tests should pass for production deployment:
- ✅ No 401/403 errors
- ✅ No JSON coercion errors
- ✅ Real-time sync works
- ✅ Activity logging works
- ✅ All Edge Functions work
- ✅ Performance is acceptable
- ✅ RLS policies work correctly

---

**Ready to test!** 🧪

