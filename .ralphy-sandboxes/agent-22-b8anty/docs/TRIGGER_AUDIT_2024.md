# Inventory & Order Trigger Audit

**Date:** December 4, 2024  
**Audited by:** Claudette  
**Total Triggers Found:** 199

## Executive Summary

The codebase had accumulated **199 database triggers** across migrations, with many conflicting or duplicating functionality. This audit identified critical issues and implemented fixes.

## Critical Issues Found

### 1. Menu Order Triggers (FIXED)
**Problem:** 6 different triggers attempting to handle menu order inventory:
- `trigger_update_inventory_from_menu_order`
- `trigger_sync_menu_order_to_main`
- `trigger_sync_menu_order_status`
- `trigger_sync_menu_order_to_systems`
- `on_menu_order_created`
- `menu_order_sync_trigger`

**Result:** Multiple inventory decrements, data inconsistency

**Fix Applied:** All disabled and replaced with `unified_menu_order_handler`

### 2. Wholesale Order Triggers (FIXED)
**Problem:** Multiple sync triggers causing double-counting
- `wholesale_order_sync_trigger`
- `trigger_restore_wholesale_inventory_on_cancel`

**Fix Applied:** Replaced with `unified_wholesale_order_handler`

### 3. Race Conditions on Balance Updates (FIXED)
**Problem:** Frontend code using read-modify-write pattern without locking

**Fix Applied:** New atomic RPCs with `FOR UPDATE` locking:
- `adjust_client_balance()` - Core balance update with row locking
- `create_fronted_inventory_atomic()` - Dispatch inventory with balance update
- `record_fronted_payment_atomic()` - Record payment with balance update
- `create_wholesale_order_atomic()` - Full order creation with idempotency
- `cancel_wholesale_order_atomic()` - Order cancellation with inventory restoration
- `create_pos_transaction_atomic()` - POS sale with inventory decrement
- `complete_delivery_with_collection()` - Delivery completion with cash collection
- `process_fronted_return_atomic()` - Return processing with balance adjustment

## Triggers by Table

### menu_orders (CONSOLIDATED)
| Trigger | Status | Purpose |
|---------|--------|---------|
| `unified_menu_order_handler` | ACTIVE | Single source of truth |
| `trigger_update_inventory_from_menu_order` | DISABLED | Replaced |
| `trigger_sync_menu_order_to_main` | DISABLED | Replaced |
| `on_menu_order_created` | DISABLED | Replaced |
| `menu_order_sync_trigger` | DISABLED | Replaced |

### wholesale_orders (CONSOLIDATED)
| Trigger | Status | Purpose |
|---------|--------|---------|
| `unified_wholesale_order_handler` | ACTIVE | Single source of truth |
| `set_wholesale_order_number_trigger` | ACTIVE | Order number generation |
| `trigger_audit_wholesale_orders` | ACTIVE | Audit logging |
| `check_subscription_before_wholesale_order` | ACTIVE | Subscription check |
| `workflow_trigger_wholesale_orders_*` | ACTIVE | Workflow automation |

### products
| Trigger | Status | Purpose |
|---------|--------|---------|
| `trigger_update_menu_visibility` | ACTIVE | Menu sync |
| `trigger_set_menu_visibility_on_insert` | ACTIVE | Menu sync |

### unified_orders
| Trigger | Status | Purpose |
|---------|--------|---------|
| `unified_orders_updated_at` | ACTIVE | Timestamp |
| `unified_orders_generate_number` | ACTIVE | Order number |

### fronted_inventory
| Trigger | Status | Purpose |
|---------|--------|---------|
| `update_fronted_inventory_updated_at` | ACTIVE | Timestamp |

## Safe Triggers (DO NOT MODIFY)

These triggers are essential and should not be disabled:

1. **Audit/Logging:**
   - `trigger_audit_orders`
   - `trigger_audit_wholesale_orders`

2. **Timestamps:**
   - `*_updated_at` triggers

3. **Number Generation:**
   - `set_wholesale_order_number_trigger`
   - `set_po_number_trigger`
   - `unified_orders_generate_number`

4. **Subscription Checks:**
   - `check_subscription_before_order`
   - `check_subscription_before_wholesale_order`

5. **Workflow Automation:**
   - `workflow_trigger_*`

## Monitoring

Query to check trigger status:

```sql
SELECT * FROM inventory_trigger_status;
```

This view shows all triggers on inventory-related tables with their current enabled/disabled status.

## Migration Files Created

1. `20251204000001_atomic_balance_operations.sql` - Atomic balance RPCs
2. `20251204000002_atomic_order_creation.sql` - Atomic order creation
3. `20251204000003_consolidate_inventory_triggers.sql` - Trigger consolidation
4. `20251204000004_pos_atomic_operations.sql` - POS transactions, delivery completion, fronted returns

## Frontend Files Modified

1. `src/components/wholesale/CancelWholesaleOrderDialog.tsx` - Fixed client lookup bug, uses atomic RPC
2. `src/pages/admin/DispatchInventory.tsx` - Uses `create_fronted_inventory_atomic` RPC
3. `src/pages/admin/RecordFrontedPayment.tsx` - Uses `record_fronted_payment_atomic` RPC
4. `src/pages/admin/PointOfSale.tsx` - Uses `create_pos_transaction_atomic` RPC
5. `src/pages/admin/CashRegister.tsx` - Uses `create_pos_transaction_atomic` RPC
6. `src/pages/admin/RecordFrontedReturn.tsx` - Uses `process_fronted_return_atomic` RPC
7. `src/pages/mobile/BigPlugRunnerPortal.tsx` - Uses `complete_delivery_with_collection` RPC

## Edge Functions Modified

1. `supabase/functions/wholesale-order-create/index.ts` - Uses atomic RPC with idempotency

## Data Integrity Improvements

### Before
- Race conditions on balance updates
- Multiple inventory decrements per order
- Client lookup by business_name (could match wrong client)
- No idempotency protection
- Inconsistent movement logging

### After
- Row-level locking prevents race conditions
- Single trigger handles each order type
- Client lookup by ID (guaranteed correct)
- Idempotency key support in order creation
- Comprehensive movement audit trail

## Recommendations for Future Development

1. **Always use atomic RPCs** for multi-step operations
2. **Never add new triggers** for inventory/orders without checking this audit
3. **Use `FOR UPDATE`** when reading data that will be modified
4. **Include idempotency keys** for any operation that could be retried
5. **Log all inventory movements** for audit trail

