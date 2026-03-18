# Disposable Menu Troubleshooting Guide

## Common Issues and Solutions

### 1. Menu Not Loading / Access Denied

**Symptoms:**
- "Access denied" or "Invalid access code" error
- Menu loads but shows no products
- White screen or infinite loading

**Possible Causes & Solutions:**

#### A. Invalid or Expired Access Code
```sql
-- Check if access code is valid
SELECT id, status, expire_at, burn_after_hours 
FROM disposable_menus 
WHERE access_code = 'YOUR_CODE';
```
**Fix:** Verify menu status is 'active' and not expired

#### B. Menu Burned or Expired
```sql
-- Check menu status
SELECT id, name, status, expire_at, burned_at 
FROM disposable_menus 
WHERE id = 'MENU_ID';
```
**Fix:** Create new menu or extend expiration

#### C. Device Already Locked
```sql
-- Check device locks
SELECT * FROM menu_device_locks 
WHERE menu_id = 'MENU_ID' AND is_locked = true;
```
**Fix:** Remove device lock or access from original device

#### D. View Limit Reached
```sql
-- Check view count
SELECT view_count, max_views 
FROM menu_access_whitelist 
WHERE menu_id = 'MENU_ID' AND customer_id = 'CUSTOMER_ID';
```
**Fix:** Increase max_views or create new whitelist entry

---

### 2. Products Not Syncing to Menu

**Symptoms:**
- Menu created but no products visible
- Products missing after creation
- Sync operation completes but nothing appears

**Possible Causes & Solutions:**

#### A. Product Visibility Settings
```sql
-- Check product visibility
SELECT id, name, menu_visibility, available_quantity 
FROM products 
WHERE tenant_id = 'TENANT_ID';
```
**Fix:** Set `menu_visibility = true` and ensure `available_quantity > 0`

#### B. Edge Function Logs
```bash
# Check sync-product-to-menu logs
supabase functions logs sync-product-to-menu
```
**Fix:** Look for errors in edge function execution

#### C. RLS Policies Blocking Access
```sql
-- Verify RLS policies on disposable_menu_products
SELECT * FROM pg_policies 
WHERE tablename = 'disposable_menu_products';
```
**Fix:** Ensure tenant has proper access policies

---

### 3. Orders Not Appearing in Admin Panel

**Symptoms:**
- Customer places order but admin doesn't see it
- Order count doesn't update
- Notification not received

**Possible Causes & Solutions:**

#### A. Order Created But Not Visible
```sql
-- Check if order exists
SELECT id, menu_id, status, total_amount, created_at 
FROM menu_orders 
WHERE menu_id = 'MENU_ID' 
ORDER BY created_at DESC;
```
**Fix:** Check RLS policies on menu_orders table

#### B. Notification Edge Function Failed
```bash
# Check notify-order-placed logs
supabase functions logs notify-order-placed
```
**Fix:** Verify edge function has proper permissions

#### C. Cart Data Not Persisting
- Check browser localStorage for cart data
- Verify cart store is properly initialized
**Fix:** Clear localStorage and test again

---

### 4. Security Feature Not Working

#### A. Geofencing Not Enforcing
```sql
-- Check geofence settings
SELECT require_geofence, geofence_lat, geofence_lng, geofence_radius 
FROM disposable_menus 
WHERE id = 'MENU_ID';
```
**Fix:** Ensure coordinates and radius are valid

#### B. Time Restrictions Not Applied
```sql
-- Check time restrictions
SELECT time_restrictions, allowed_hours 
FROM disposable_menus 
WHERE id = 'MENU_ID';
```
**Fix:** Verify `allowed_hours` JSON structure: `{"start": 9, "end": 21}`

#### C. Auto-Burn Not Triggering
```sql
-- Check burn settings
SELECT burn_after_hours, created_at, burned_at 
FROM disposable_menus 
WHERE id = 'MENU_ID';
```
**Fix:** Auto-burn requires a scheduled job or manual trigger

---

### 5. Access Code Rotation Issues

**Symptoms:**
- Old access codes still work after rotation
- New codes not being generated
- Customers can't access after rotation

**Solution:**
```sql
-- Check code rotation settings
SELECT access_code_rotation_enabled, access_code_rotation_days, 
       last_code_rotation_at 
FROM disposable_menus 
WHERE id = 'MENU_ID';

-- Manually rotate code
UPDATE disposable_menus 
SET access_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
    last_code_rotation_at = NOW()
WHERE id = 'MENU_ID';
```

---

## Debugging Checklist

### When Creating a Menu:
- [ ] Verify tenant_id is correct
- [ ] Ensure at least one product is synced
- [ ] Check that menu status is 'active'
- [ ] Confirm access_code is generated
- [ ] Validate expire_at is in the future

### When Sharing a Menu:
- [ ] Test the access link in incognito mode
- [ ] Verify access code is communicated correctly
- [ ] Check that customer receives the link
- [ ] Ensure menu is not expired or burned

### When Placing an Order:
- [ ] Confirm products are in stock
- [ ] Verify cart data persists across refreshes
- [ ] Check that order appears in database
- [ ] Ensure notifications are sent (check logs)
- [ ] Validate order status updates correctly

### When Reviewing Security:
- [ ] Test access from different devices
- [ ] Verify geofence enforcement (if enabled)
- [ ] Check time restriction compliance
- [ ] Confirm view limits are respected
- [ ] Test device locking functionality

---

## Edge Function Error Codes

### menu-access-validate
- `400`: Missing required fields (menu_id, access_code)
- `403`: Access denied (expired, burned, locked)
- `404`: Menu not found
- `423`: Device locked

### menu-order-place
- `400`: Invalid order data or empty cart
- `403`: Menu not accepting orders
- `409`: Insufficient product quantity
- `500`: Database error during order creation

### sync-product-to-menu
- `400`: Invalid product_id or tenant_id
- `404`: Product not found
- `200` (no menus): No active menus to sync

### notify-order-placed
- `400`: Missing order_id
- `404`: Order not found
- `200`: Notifications logged (check account_logs)

---

## Performance Optimization

### Slow Menu Loading
1. Add indexes to frequently queried fields:
```sql
CREATE INDEX IF NOT EXISTS idx_menu_access_logs_menu_customer 
ON menu_access_logs(menu_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_menu_orders_status 
ON menu_orders(menu_id, status);
```

2. Enable query caching on frontend:
```typescript
const { data } = useQuery({
  queryKey: ['menu', menuId],
  queryFn: () => fetchMenu(menuId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### High Edge Function Latency
- Check Supabase project region
- Monitor database connection pool
- Review RLS policy complexity
- Consider caching frequently accessed data

---

## Security Audit Checklist

- [ ] All RLS policies are enabled on tables
- [ ] Edge functions validate tenant_id
- [ ] Access codes are cryptographically secure
- [ ] Device fingerprints are properly hashed
- [ ] IP addresses are logged for suspicious activity
- [ ] Security events are monitored regularly
- [ ] Customer data is encrypted at rest
- [ ] HTTPS is enforced for all connections

---

## Support and Monitoring

### Key Metrics to Track
1. **Menu Performance**
   - Active menus count
   - Average menu lifetime
   - Burn rate (manual vs auto)

2. **Order Metrics**
   - Orders per menu
   - Average order value
   - Order completion rate

3. **Security Metrics**
   - Access denied attempts
   - Device lock frequency
   - Geofence violations
   - Suspicious activity events

### Monitoring Queries
```sql
-- Recent security events
SELECT * FROM menu_security_events 
WHERE severity IN ('high', 'critical') 
ORDER BY created_at DESC 
LIMIT 50;

-- Failed access attempts
SELECT menu_id, COUNT(*) as failed_attempts 
FROM menu_access_logs 
WHERE action = 'denied' 
AND created_at > NOW() - INTERVAL '24 hours' 
GROUP BY menu_id 
ORDER BY failed_attempts DESC;

-- Order status distribution
SELECT status, COUNT(*) as count 
FROM menu_orders 
GROUP BY status;
```
