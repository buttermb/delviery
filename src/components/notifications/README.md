# Notification System Implementation

This directory contains a comprehensive notification system for FloraIQ with in-app notifications, preferences, and realtime updates.

## Components

### NotificationCenter
**File:** `NotificationCenter.tsx`

Dropdown notification center with:
- Bell icon with unread count badge
- Tabs for "All" and "Unread" notifications
- Mark all as read functionality
- Individual notification items
- Link to full notification history

**Usage:**
```tsx
import { NotificationCenter } from '@/components/notifications';

<NotificationCenter />
```

### NotificationItem
**File:** `NotificationItem.tsx`

Individual notification display with:
- Icon based on notification type
- Color coding per type
- Title and message
- Relative timestamp
- Unread indicator (blue dot)
- Action buttons (view, delete)
- Click to navigate to action URL

### NotificationHistory
**File:** `NotificationHistory.tsx`

Full-page notification history with:
- Search by title/message
- Filter by type (order, payment, delivery, etc.)
- Filter by read status
- Mark all as read
- Individual notification actions

### NotificationPreferences
**File:** `NotificationPreferences.tsx`

User notification preferences with:
- Email notifications (all updates, confirmation only)
- Push notifications (all updates, critical only)
- SMS notifications (all updates, critical only)
- Toggle on/off for each channel
- Saves to `notification_preferences` table

## Hooks

### useNotifications
**File:** `useNotifications.ts`

Main hook for notification functionality:
- Fetches user notifications
- Realtime subscription to new notifications
- Counts unread notifications
- Mark as read mutation
- Mark all as read mutation
- Delete notification mutation
- Plays sound on new notifications

**Usage:**
```tsx
const {
  notifications,
  unreadCount,
  isLoading,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = useNotifications();
```

### useNotificationBadges
**File:** `useNotificationBadges.ts`

Hook for sidebar badge counts:
- Pending orders count
- Active deliveries count
- Overdue invoices count
- Low stock products count
- New customers (last 24h) count
- Pending payments count

**Usage:**
```tsx
const { badgeCounts, isLoading } = useNotificationBadges();

// badgeCounts.orders
// badgeCounts.deliveries
// badgeCounts.invoices
// badgeCounts.stock
// badgeCounts.customers
// badgeCounts.payments
```

## Helpers

### notificationHelpers.ts

Helper functions for creating notifications:

- `createNotification()` - Generic notification creator
- `notifyOrderStatusChange()` - Order status changes
- `notifyLowStock()` - Low stock alerts
- `notifyDeliveryAlert()` - Delivery alerts (late, offline, exception, completed)
- `notifyPaymentReceived()` - Payment confirmations
- `notifyDriverStatusChange()` - Driver status updates
- `notifyMenuExpiring()` - Menu expiration warnings
- `notifyNewCustomer()` - New customer signups
- `notifySystemMaintenance()` - System maintenance alerts
- `notifyInvoiceOverdue()` - Overdue invoice alerts
- `notifyMention()` - Team member mentions

**Usage:**
```tsx
import { notifyOrderStatusChange } from '@/components/notifications';

await notifyOrderStatusChange(
  tenantId,
  userId,
  orderId,
  orderNumber,
  'confirmed'
);
```

### notificationDeduplication.ts

Utilities for preventing duplicate notifications:

- `shouldSendNotification()` - Check if notification is duplicate
- `createDeduplicationKey()` - Generate dedup key from params
- `createNotificationWithDeduplication()` - Create with dedup check
- `batchSendNotifications()` - Send multiple with dedup

**Usage:**
```tsx
import { createNotificationWithDeduplication, createDeduplicationKey } from '@/components/notifications';

const dedupKey = createDeduplicationKey('order_status', { orderId });

await createNotificationWithDeduplication({
  tenantId,
  userId,
  type: 'order_status',
  title: 'Order Updated',
  message: 'Your order status changed',
  deduplicationKey: dedupKey,
  deduplicationWindowMinutes: 15, // Don't send duplicate within 15 min
});
```

## Notification Types

The system supports these notification types:

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `order_status` | Package | Blue | Order status changes |
| `payment` | DollarSign | Green | Payment confirmations |
| `delivery` | Truck | Purple | Delivery updates |
| `driver` | User | Orange | Driver status changes |
| `stock` | AlertTriangle | Red | Low stock alerts |
| `customer` | User | Cyan | New customers |
| `invoice` | FileText | Yellow | Invoice alerts |
| `menu` | Calendar | Pink | Menu expiration |
| `system` | Info | Gray | System alerts |
| `mention` | Bell | Indigo | Team mentions |

## Realtime Updates

The system uses Supabase Realtime for instant notification delivery:

1. New notifications trigger INSERT event
2. Hook receives event via channel subscription
3. Plays notification sound
4. Shows toast notification
5. Invalidates queries to refresh UI
6. Updates unread count badge

## Database Requirements

The notification system requires an `in_app_notifications` table. See `MIGRATION_NEEDED.md` for the SQL migration script.

### Existing Tables Used

- `notification_preferences` - User notification settings (exists)
- `notification_templates` - Admin-managed templates (exists)
- `notification_delivery_log` - Delivery tracking (exists)

### Required Table

- `in_app_notifications` - Main notification storage (needs migration)

## Integration Examples

### Add to Navigation Header

```tsx
import { NotificationCenter } from '@/components/notifications';

<nav>
  <NotificationCenter />
</nav>
```

### Add Sidebar Badges

```tsx
import { useNotificationBadges } from '@/components/notifications';

function Sidebar() {
  const { badgeCounts } = useNotificationBadges();

  return (
    <nav>
      <SidebarItem href="/admin/orders">
        Orders
        {badgeCounts?.orders > 0 && (
          <Badge>{badgeCounts.orders}</Badge>
        )}
      </SidebarItem>
      <SidebarItem href="/admin/deliveries">
        Deliveries
        {badgeCounts?.deliveries > 0 && (
          <Badge>{badgeCounts.deliveries}</Badge>
        )}
      </SidebarItem>
    </nav>
  );
}
```

### Send Notification on Order Update

```tsx
import { notifyOrderStatusChange } from '@/components/notifications';

async function updateOrderStatus(orderId: string, newStatus: string) {
  // Update order
  await updateOrder(orderId, { status: newStatus });

  // Notify user
  await notifyOrderStatusChange(
    tenantId,
    userId,
    orderId,
    orderNumber,
    newStatus
  );
}
```

### Add to Settings Page

```tsx
import { NotificationPreferences } from '@/components/notifications';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <NotificationPreferences />
    </div>
  );
}
```

## Features Implemented

- [x] In-app notification center (Task 436)
- [x] Order status change notifications (Task 437)
- [x] Low stock alert notifications (Task 438)
- [x] Delivery alert notifications (Task 439)
- [x] Payment received notification (Task 440)
- [x] Driver status change notifications (Task 441)
- [x] Notification preferences per user (Task 442)
- [x] Notification sound alerts (Task 443)
- [x] Expiring menu notifications (Task 446)
- [x] New customer signup notification (Task 447)
- [x] System maintenance notifications (Task 448)
- [x] Invoice overdue notifications (Task 449)
- [x] Team member mention notifications (Task 450)
- [x] Notification history page (Task 451)
- [x] Realtime notification via Supabase (Task 452)
- [x] Notification badge counts per section (Task 453)
- [x] Notification action buttons (Task 454)
- [x] Notification deduplication (Task 455)

## Pending Features

- [ ] Notification digest email (Task 444) - requires backend email service
- [ ] Notification templates manager (Task 445) - admin UI for editing templates

## Performance Considerations

1. **Query Optimization**
   - Uses `queryKeys` factory for proper cache management
   - Stale time: 30 seconds for notifications, 60 seconds for badges
   - Auto-refetch every 60 seconds for badge counts

2. **Realtime Subscription**
   - Single channel per user
   - Filters by `user_id` on server side
   - Cleans up on unmount

3. **Deduplication**
   - Time-window based (default 15 minutes)
   - Prevents notification spam
   - Metadata-based key matching

4. **UI Performance**
   - Lazy loading with Suspense boundaries
   - Optimistic updates for mark as read
   - Batch mutations for mark all as read

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Focus management in dropdown
- Color contrast compliance

## Future Enhancements

1. Push notifications (browser API)
2. Notification grouping by type
3. Snooze/reminder functionality
4. Archive old notifications
5. Export notification history
6. Advanced filtering (date range, multiple types)
7. Notification analytics
8. Customizable notification templates per tenant
9. Webhook support for external notifications
10. SMS/Email delivery queue
