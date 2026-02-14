# Disposable Menu Testing Guide

## Phase 3: Security Features Testing

### Test 1: Auto-Burn After Hours
**Objective:** Verify menus automatically burn after specified time period

**Setup:**
```sql
-- Create test menu with 1-hour burn time
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status,
  burn_after_hours, expire_at
) VALUES (
  'YOUR_TENANT_ID',
  'Test Auto-Burn',
  'Auto-Burn Test Menu',
  'TEST01',
  'active',
  1, -- 1 hour
  NOW() + INTERVAL '7 days'
);
```

**Test Steps:**
1. Create menu with `burn_after_hours = 1`
2. Wait 1 hour (or manually update `created_at` to simulate)
3. Try to access menu
4. Expected: Access denied, status = 'burned'

**Simulation Query:**
```sql
-- Simulate time passage
UPDATE disposable_menus 
SET created_at = NOW() - INTERVAL '2 hours'
WHERE access_code = 'TEST01';

-- Manually trigger burn check (would normally be done by scheduled job)
UPDATE disposable_menus 
SET status = 'burned', burned_at = NOW()
WHERE burn_after_hours IS NOT NULL 
  AND created_at + (burn_after_hours || ' hours')::INTERVAL < NOW()
  AND status = 'active';
```

**Validation:**
```sql
SELECT id, name, status, burned_at, 
       created_at, burn_after_hours
FROM disposable_menus 
WHERE access_code = 'TEST01';
-- Expected: status = 'burned', burned_at IS NOT NULL
```

---

### Test 2: Device Locking
**Objective:** Verify only first device can access menu

**Setup:**
```sql
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status,
  require_device_lock, max_devices
) VALUES (
  'YOUR_TENANT_ID',
  'Test Device Lock',
  'Device Lock Test',
  'TEST02',
  'active',
  true,
  1
);
```

**Test Steps:**
1. Access menu from Device A (Chrome on Desktop)
2. Note device fingerprint is saved
3. Try accessing from Device B (Safari on Mobile)
4. Expected: Access denied with "Device not authorized" error

**Validation:**
```sql
-- Check device locks
SELECT * FROM menu_device_locks 
WHERE menu_id = (SELECT id FROM disposable_menus WHERE access_code = 'TEST02');
-- Expected: 1 row with is_locked = true

-- Check security events
SELECT * FROM menu_security_events 
WHERE menu_id = (SELECT id FROM disposable_menus WHERE access_code = 'TEST02')
  AND event_type = 'device_mismatch';
-- Expected: At least 1 security event logged
```

---

### Test 3: View Limits
**Objective:** Verify access is denied after max views reached

**Setup:**
```sql
-- Create menu with whitelist entry having view limit
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status, invite_only
) VALUES (
  'YOUR_TENANT_ID', 'Test View Limit', 'View Limit Test', 
  'TEST03', 'active', true
) RETURNING id;

-- Add whitelist entry with 3 view limit
INSERT INTO menu_access_whitelist (
  menu_id, customer_id, customer_name, max_views, status
) VALUES (
  'MENU_ID_FROM_ABOVE',
  'test-customer-id',
  'Test Customer',
  3,
  'active'
);
```

**Test Steps:**
1. Access menu 3 times (check console logs)
2. On 4th access attempt, should be denied
3. Expected: "View limit exceeded" error

**Validation:**
```sql
SELECT view_count, max_views, status 
FROM menu_access_whitelist 
WHERE menu_id = (SELECT id FROM disposable_menus WHERE access_code = 'TEST03');
-- Expected: view_count = 3, max_views = 3
```

---

### Test 4: Geofencing
**Objective:** Verify location-based access control

**Setup:**
```sql
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status,
  require_geofence, geofence_lat, geofence_lng, geofence_radius
) VALUES (
  'YOUR_TENANT_ID',
  'Test Geofence',
  'NYC Only Menu',
  'TEST04',
  'active',
  true,
  40.7128, -- NYC latitude
  -74.0060, -- NYC longitude
  25 -- 25 mile radius
);
```

**Test Steps:**
1. Mock customer location to NYC coordinates
2. Expected: Access granted
3. Mock customer location to LA coordinates (34.0522, -118.2437)
4. Expected: Access denied with "Location not authorized" error

**Test Code (Frontend):**
```typescript
// In SecureMenuAccess.tsx or test file
const testGeofence = async () => {
  // Test 1: Valid location (NYC)
  const validResult = await supabase.functions.invoke('menu-access-validate', {
    body: {
      menu_id: 'MENU_ID',
      access_code: 'TEST04',
      user_location: { lat: 40.7128, lng: -74.0060 }
    }
  });
  console.log('NYC Test:', validResult); // Should succeed

  // Test 2: Invalid location (LA)
  const invalidResult = await supabase.functions.invoke('menu-access-validate', {
    body: {
      menu_id: 'MENU_ID',
      access_code: 'TEST04',
      user_location: { lat: 34.0522, lng: -118.2437 }
    }
  });
  console.log('LA Test:', invalidResult); // Should fail
};
```

---

### Test 5: Time Restrictions
**Objective:** Verify time-based access control

**Setup:**
```sql
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status,
  time_restrictions, allowed_hours
) VALUES (
  'YOUR_TENANT_ID',
  'Test Time Restriction',
  'Business Hours Only',
  'TEST05',
  'active',
  true,
  '{"start": 9, "end": 17}'::jsonb -- 9 AM to 5 PM
);
```

**Test Steps:**
1. Set system time to 10 AM (or mock in edge function)
2. Expected: Access granted
3. Set system time to 8 PM
4. Expected: Access denied with "Outside allowed hours" error

**Validation Query:**
```sql
-- Check current hour against restrictions
SELECT 
  id, name, allowed_hours,
  EXTRACT(HOUR FROM NOW()) as current_hour,
  (allowed_hours->>'start')::int as start_hour,
  (allowed_hours->>'end')::int as end_hour
FROM disposable_menus 
WHERE access_code = 'TEST05';
```

---

### Test 6: Access Code Rotation
**Objective:** Verify automatic code rotation invalidates old codes

**Setup:**
```sql
INSERT INTO disposable_menus (
  tenant_id, name, title, access_code, status,
  access_code_rotation_enabled, access_code_rotation_days
) VALUES (
  'YOUR_TENANT_ID',
  'Test Code Rotation',
  'Rotating Code Test',
  'OLDCODE',
  'active',
  true,
  7 -- Rotate every 7 days
);
```

**Test Steps:**
1. Note original access code: 'OLDCODE'
2. Simulate 7 days passing OR manually trigger rotation:
```sql
UPDATE disposable_menus 
SET access_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
    last_code_rotation_at = NOW()
WHERE access_code = 'OLDCODE'
RETURNING access_code as new_code;
```
3. Try accessing with old code: Expected FAIL
4. Try accessing with new code: Expected SUCCESS

---

## Phase 4: Integration Testing

### Complete Order Flow Test

**Scenario:** End-to-end menu creation → sharing → ordering → notification

**Step 1: Admin Creates Menu**
```typescript
// In CreateMenuDialog.tsx
const createMenu = async () => {
  const { data, error } = await supabase
    .from('disposable_menus')
    .insert({
      tenant_id: currentTenant.id,
      name: 'Integration Test Menu',
      title: 'Test Catalog',
      business_name: 'Test Business',
      access_code: generateAccessCode(),
      status: 'active',
      expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })
    .select()
    .single();
  
  console.log('Menu created:', data);
  return data;
};
```

**Step 2: Sync Products to Menu**
```typescript
const syncProducts = async (menuId: string) => {
  const { data, error } = await supabase.functions.invoke('sync-product-to-menu', {
    body: {
      product_id: 'PRODUCT_ID_1',
      tenant_id: currentTenant.id,
      menu_ids: [menuId]
    }
  });
  
  console.log('Product synced:', data);
};
```

**Step 3: Share Menu via WhatsApp**
```typescript
const shareMenu = (menu: any) => {
  const accessUrl = `${window.location.origin}/m/${menu.url_token}`;
  const message = generateWhatsAppMessage(
    'Test Customer',
    accessUrl,
    menu.access_code
  );
  
  window.open(`https://wa.me/?text=${message}`, '_blank');
};
```

**Step 4: Customer Accesses Menu**
```typescript
// Navigate to /m/{url_token}
// Enter access code when prompted
// Verify products are visible
```

**Step 5: Customer Places Order**
```typescript
// In cart store
const placeOrder = async () => {
  const { data, error } = await supabase.functions.invoke('menu-order-place', {
    body: {
      menu_id: menuId,
      customer_id: 'test-customer',
      items: cartItems,
      total_amount: cartTotal,
      delivery_address: '123 Test St',
      contact_phone: '+1234567890',
      customer_notes: 'Test order'
    }
  });
  
  console.log('Order placed:', data);
};
```

**Step 6: Verify Order in Admin Panel**
```typescript
// Navigate to /{tenantSlug}/admin/menus
// Click on menu → Orders tab
// Verify order appears with correct details
```

**Step 7: Check Notifications**
```sql
-- Verify notifications were logged
SELECT * FROM account_logs 
WHERE action = 'order_notification_sent' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check security events
SELECT * FROM menu_security_events 
WHERE event_type = 'new_order' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Success Criteria

### All Tests Must Pass:
- [ ] Auto-burn triggers after specified hours
- [ ] Device locking prevents multi-device access
- [ ] View limits are enforced correctly
- [ ] Geofencing blocks unauthorized locations
- [ ] Time restrictions prevent off-hours access
- [ ] Access code rotation invalidates old codes
- [ ] Complete order flow works without errors
- [ ] Notifications are sent and logged
- [ ] Security events are properly recorded
- [ ] Edge function logs show no errors

### Performance Benchmarks:
- [ ] Menu load time < 2 seconds
- [ ] Order placement < 3 seconds
- [ ] Access validation < 500ms
- [ ] Product sync < 5 seconds (for 50 products)

### Security Validation:
- [ ] No cross-tenant data leaks
- [ ] All RLS policies enforced
- [ ] Access codes are cryptographically secure
- [ ] Device fingerprints properly hashed
- [ ] All security events logged

---

## Automated Testing Script

```sql
-- Run all validation checks at once
DO $$
DECLARE
  test_results TEXT := '';
BEGIN
  -- Test 1: Check active menus
  IF EXISTS (SELECT 1 FROM disposable_menus WHERE status = 'active') THEN
    test_results := test_results || '✅ Active menus exist\n';
  ELSE
    test_results := test_results || '❌ No active menus found\n';
  END IF;
  
  -- Test 2: Check menu products
  IF EXISTS (SELECT 1 FROM disposable_menu_products) THEN
    test_results := test_results || '✅ Menu products synced\n';
  ELSE
    test_results := test_results || '❌ No menu products found\n';
  END IF;
  
  -- Test 3: Check RLS policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_orders') THEN
    test_results := test_results || '✅ RLS policies exist\n';
  ELSE
    test_results := test_results || '❌ Missing RLS policies\n';
  END IF;
  
  -- Test 4: Check edge functions (via function exists check)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_access_code') THEN
    test_results := test_results || '✅ Helper functions exist\n';
  ELSE
    test_results := test_results || '⚠️ Some functions may be missing\n';
  END IF;
  
  RAISE NOTICE '%', test_results;
END $$;
```
