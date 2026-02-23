# Deployment Guide: Menu Order Integration

## Overview
This guide walks through deploying the database triggers that sync disposable menu orders into the main orders system.

## Prerequisites
- Access to Supabase SQL Editor
- At least one active disposable menu (for testing)
- At least one product in `wholesale_inventory` (for testing)

---

## Step 1: Deploy Migrations

Run migrations in **exact order** in Supabase SQL Editor:

### Migration 1: Add tenant_id Column
```bash
File: supabase/migrations/20250122000001_add_tenant_id_to_disposable_menus.sql
```
**Expected Output:**
```
NOTICE: Added tenant_id column to disposable_menus
NOTICE: Backfilled tenant_id for X existing menus
```

### Migration 2: Create Order Sync Trigger
```bash
File: supabase/migrations/20250122000002_sync_menu_orders_to_orders.sql
```
**Expected Output:**
```
NOTICE: Created triggers to sync menu_orders to main orders table
```

### Migration 3: Backfill Existing Orders
```bash
File: supabase/migrations/20250122000003_backfill_menu_orders.sql
```
**Expected Output:**
```
NOTICE: Backfilled X existing menu_orders into main orders table
```

### Migration 4: Inventory Sync Trigger
```bash
File: supabase/migrations/20250122000004_menu_orders_inventory_sync.sql
```
**Expected Output:**
```
NOTICE: Created trigger to automatically decrement inventory when menu orders are confirmed
```

---

## Step 2: Run Test Suite

Open `supabase/migrations/TESTING_GUIDE.sql` and run each test section:

### ✅ TEST 1: Verify Triggers Exist
**Expected:** 3 triggers on `menu_orders` table

### ✅ TEST 2: Check tenant_id Column
**Expected:** Column exists with UUID type

### ✅ TEST 3: Test Order Sync
**Expected:** 
```
NOTICE: ✓ Created test menu_order: <uuid>
NOTICE: ✓ Order successfully synced to main orders table
```

### ✅ TEST 4: Check Backfilled Orders
**Expected:** See existing orders with `order_number` like `MENU-XXXXXXXX`

### ✅ TEST 5: Compare Counts
**Expected:** `menu_orders` count = `orders (from menus)` count

### ✅ TEST 6: Test Inventory Decrement
**Expected:**
```
NOTICE: ✓ Inventory correctly decremented: X → Y lbs
```

---

## Step 3: User Acceptance Testing

### Test Scenario 1: Place New Order

1. **Navigate to disposable menu** (use public URL from menu management)
2. **Add products to cart**
3. **Complete checkout** and submit order
4. **Immediately check Live Orders panel** (`/admin/live-orders`)
   - ✅ Order should appear within 1-2 seconds
   - ✅ Order number should be `MENU-XXXXXXXX`
   - ✅ Status should be `pending`

### Test Scenario 2: Confirm Order
1. **Update menu order status to confirmed** in database:
   ```sql
   UPDATE menu_orders 
   SET status = 'confirmed' 
   WHERE id = '<order_id>';
   ```
2. **Check Live Orders panel**
   - ✅ Status should update to `confirmed` automatically
3. **Check Inventory panel**
   - ✅ Product quantities should decrease

### Test Scenario 3: Real-Time Updates
1. **Open Live Orders panel** in one browser tab
2. **Place order via disposable menu** in another tab
3. **Watch Live Orders panel** (do NOT refresh)
   - ✅ Order should appear automatically without refresh
   - ✅ "Live" badge should be pulsing

---

## Step 4: Verify Dashboard Panels

| Panel | Test | Expected Result |
|-------|------|-----------------|
| **Live Orders** | Place menu order | ✅ Appears immediately |
| **Orders** (main) | Check order list | ✅ Shows menu orders with `MENU-` prefix |
| **Inventory** | Confirm order | ✅ Quantities decrement |
| **CRM Pre-Orders** | n/a | ⚠️ Requires Phase 3 (optional) |
| **Finance Revenue** | Check totals | ✅ Menu order amounts included |
| **Analytics** | View sales data | ✅ Menu orders counted |

---

## Troubleshooting

### Issue: Orders Not Appearing in Live Orders

**Check 1:** Verify trigger exists
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_sync_menu_order_to_main';
```

**Check 2:** Manually check if order was synced
```sql
SELECT * FROM orders WHERE metadata->>'source' = 'disposable_menu';
```

**Check 3:** Look for errors in Supabase logs
- Navigate to Database → Logs
- Filter for "sync_menu_order"

### Issue: Inventory Not Decrementing

**Check:** Verify order status is `confirmed`
```sql
SELECT id, status FROM menu_orders WHERE id = '<order_id>';
```

**Check:** Manual inventory update
```sql
UPDATE wholesale_inventory 
SET quantity_lbs = quantity_lbs - 5 
WHERE id = '<product_id>';
```

### Issue: Duplicate Orders

**Cause:** Trigger ran multiple times or backfill re-ran

**Fix:** Remove duplicates
```sql
DELETE FROM orders o1
USING orders o2
WHERE o1.id = o2.id 
  AND o1.ctid > o2.ctid
  AND o1.metadata->>'source' = 'disposable_menu';
```

---

## Rollback Plan

If something goes wrong, rollback in reverse order:

```sql
-- Step 1: Drop triggers
DROP TRIGGER IF EXISTS trigger_update_inventory_from_menu_order ON menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_status ON menu_orders;
DROP TRIGGER IF EXISTS trigger_sync_menu_order_to_main ON menu_orders;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS update_inventory_from_menu_order();
DROP FUNCTION IF EXISTS sync_menu_order_status_update();
DROP FUNCTION IF EXISTS sync_menu_order_to_main_orders();

-- Step 3: Remove synced orders (optional - only if corrupt data)
-- DELETE FROM orders WHERE metadata->>'source' = 'disposable_menu';

-- Step 4: Remove tenant_id column (optional - only if major issues)
-- ALTER TABLE disposable_menus DROP COLUMN IF EXISTS tenant_id;
```

---

## Success Criteria

✅ All triggers created successfully  
✅ Existing menu orders backfilled into orders table  
✅ New menu orders appear in Live Orders within 2 seconds  
✅ Order status updates propagate automatically  
✅ Inventory decrements when orders confirmed  
✅ No duplicate orders created  
✅ Real-time subscriptions working  

---

## Post-Deployment Monitoring

Monitor for 24 hours after deployment:

1. **Check Supabase logs** for trigger errors
2. **Monitor inventory levels** for accuracy
3. **Verify order counts** match between tables
4. **Test with real customer orders** (if applicable)

---

## Next Steps (Optional)

- **Phase 3: CRM Integration** - Convert menu orders to pre-orders automatically
- **Enhanced Analytics** - Create views joining menu_orders with customer data
- **Reporting** - Build dashboards showing menu-specific performance
