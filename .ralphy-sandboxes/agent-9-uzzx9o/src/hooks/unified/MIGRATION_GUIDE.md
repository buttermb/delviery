# Migration Guide: Unified Data Hooks

This guide explains how to migrate from the old hook patterns to the new unified hooks.

## Overview

The new unified data architecture consolidates multiple tables and hooks:

| Old Pattern | New Pattern |
|-------------|-------------|
| `orders` + `menu_orders` + `wholesale_orders` + `pos_transactions` | `unified_orders` |
| `customers` + `wholesale_clients` + `crm_clients` | `contacts` |
| 9+ audit tables | `audit_events` |

## Hook Migration

### Orders

```tsx
// OLD - Multiple hooks for different order types
import { useWholesaleOrders } from '@/hooks/useWholesaleData';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

// NEW - Single unified hook with type filter
import { useUnifiedOrders } from '@/hooks/unified';

// Wholesale orders
const { data: orders } = useUnifiedOrders({ orderType: 'wholesale' });

// Menu orders
const { data: orders } = useUnifiedOrders({ orderType: 'menu' });

// Retail orders
const { data: orders } = useUnifiedOrders({ orderType: 'retail' });

// All orders (with real-time updates)
const { data: orders } = useUnifiedOrders({ 
  orderType: 'all',
  realtime: true,
  status: 'pending' // optional filter
});
```

### Contacts/Clients

```tsx
// OLD - Separate hooks
import { useWholesaleClients } from '@/hooks/useWholesaleData';
import { useClients } from '@/hooks/useCRM';

// NEW - Single unified hook
import { useContacts, useWholesaleContactsList } from '@/hooks/unified';

// Wholesale clients
const { data: clients } = useContacts({ contactType: 'wholesale' });
// OR use convenience hook
const { data: clients } = useWholesaleContactsList();

// CRM leads
const { data: leads } = useContacts({ contactType: 'crm' });

// Retail customers
const { data: customers } = useContacts({ contactType: 'retail' });
```

### Creating Orders

```tsx
// OLD
const createOrder = async (data) => {
  const { data: order, error } = await supabase
    .from('wholesale_orders')
    .insert(data);
};

// NEW
import { useCreateUnifiedOrder } from '@/hooks/unified';

const createOrder = useCreateUnifiedOrder();

await createOrder.mutateAsync({
  order_type: 'wholesale',
  source: 'admin',
  items: [
    { product_name: 'Blue Dream', quantity: 5, unit_price: 100 }
  ],
  wholesale_client_id: 'uuid',
  delivery_address: '123 Main St',
});
```

### Order Status Updates

```tsx
// OLD
await supabase
  .from('wholesale_orders')
  .update({ status: 'delivered' })
  .eq('id', orderId);

// NEW
import { useUpdateOrderStatus } from '@/hooks/unified';

const updateStatus = useUpdateOrderStatus();

await updateStatus.mutateAsync({
  orderId: 'uuid',
  status: 'delivered',
  notes: 'Delivered to reception',
});
```

### Contact Balance Updates

```tsx
// NEW
import { useUpdateContactBalance } from '@/hooks/unified';

const updateBalance = useUpdateContactBalance();

// Add to balance (e.g., new order)
await updateBalance.mutateAsync({
  contactId: 'uuid',
  amount: 500,
  operation: 'add',
});

// Subtract from balance (e.g., payment received)
await updateBalance.mutateAsync({
  contactId: 'uuid',
  amount: 200,
  operation: 'subtract',
});
```

## Statistics

```tsx
// Order stats
import { useOrderStats } from '@/hooks/unified';

const { data: stats } = useOrderStats('wholesale');
// Returns: { total, pending, confirmed, delivered, revenue, ... }

// Contact stats
import { useContactStats } from '@/hooks/unified';

const { data: stats } = useContactStats('wholesale');
// Returns: { total, active, totalOutstanding, totalLifetimeValue, ... }
```

## Real-time Subscriptions

Real-time is enabled by default. To disable:

```tsx
const { data: orders } = useUnifiedOrders({ 
  orderType: 'wholesale',
  realtime: false  // Disable real-time updates
});
```

## Backward Compatibility

The old tables and hooks will continue to work during the migration period. The new unified tables have views that mirror the old table structures:

- `wholesale_orders_unified` → mirrors `wholesale_orders`
- `menu_orders_unified` → mirrors `menu_orders`
- `contacts` → has views for `wholesale_clients_unified`, `customers_unified`, etc.

## Database Migration

To apply the database migrations:

```bash
supabase migration up
```

The migrations create:
1. `unified_orders` table with all order types
2. `unified_order_items` table for line items
3. `contacts` table with all contact types
4. `audit_events` partitioned table
5. Backward-compatible views
6. RPC functions for atomic operations

