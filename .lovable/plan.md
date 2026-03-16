

# Fix: Live Order Views — Wire Marketplace-Aware Courier Assignment

## Problem

Three live order views import the **legacy** `AssignToFleetDialog` from `src/components/admin/AssignToFleetDialog.tsx`, which only updates the `orders` table when assigning a courier. The **fulfillment version** at `src/components/admin/fulfillment/AssignToFleetDialog.tsx` already supports `isMarketplace` prop and correctly targets `marketplace_orders`, but none of the live order views use it.

```
Legacy (used by live views):     orders.update({ courier_id, status })
Fulfillment (unused by live):    marketplace_orders.update({ courier_id, status })  ← when isMarketplace=true
```

## Approach

### 1. Add `source_table` to `LiveOrder` type

Add an optional `source_table?: 'orders' | 'menu_orders' | 'marketplace_orders'` field to the `LiveOrder` interface in `LiveOrdersKanban.tsx`. This lets each order carry its origin so the dialog knows which table to target.

### 2. Switch all 3 live order views to the fulfillment dialog

Replace the import in these files:

- `src/components/admin/live-orders/LiveOrdersKanban.tsx`
- `src/components/admin/live-orders/LiveOrdersListView.tsx`
- `src/components/admin/live-orders/LiveOrdersMobileList.tsx`

Change from:
```ts
import { AssignToFleetDialog } from '@/components/admin/AssignToFleetDialog';
```
To:
```ts
import { AssignToFleetDialog } from '@/components/admin/fulfillment/AssignToFleetDialog';
```

And pass `isMarketplace={order.source_table === 'marketplace_orders'}` to each dialog instance.

### 3. Populate `source_table` where live orders are fetched

Find where live orders are queried/merged (the hook or page that feeds orders into these views) and tag each order with its `source_table` value so the prop is available downstream.

### 4. Reconcile prop differences

The two dialogs have slightly different prop signatures:
- Legacy: `isWholesale` (default `true`)
- Fulfillment: `isWholesale` (default `false`) + `isMarketplace`

The fulfillment version already handles the 3-way table selection (`marketplace_orders` / `wholesale_orders` / `orders`), so it's a drop-in replacement — just need to pass the right boolean.

## Files Changed

| File | Change |
|------|--------|
| `LiveOrdersKanban.tsx` | Add `source_table` to `LiveOrder`, switch dialog import, pass `isMarketplace` |
| `LiveOrdersListView.tsx` | Switch dialog import, pass `isMarketplace` |
| `LiveOrdersMobileList.tsx` | Switch dialog import, pass `isMarketplace` |
| Live orders data hook/page | Tag orders with `source_table` when fetching |

