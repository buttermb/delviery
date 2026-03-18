import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  message,
  actionUrl,
  metadata,
}: CreateNotificationParams): Promise<void> {
  try {
    const { error } = await supabase.from('in_app_notifications').insert({
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl || null,
      metadata: metadata || null,
      read: false,
    });

    if (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

// Order status change notifications
export async function notifyOrderStatusChange(
  tenantId: string,
  userId: string,
  orderId: string,
  orderNumber: string,
  newStatus: string
): Promise<void> {
  const statusMessages: Record<string, string> = {
    pending: 'Order is pending confirmation',
    confirmed: 'Order has been confirmed',
    preparing: 'Order is being prepared',
    ready: 'Order is ready for pickup/delivery',
    out_for_delivery: 'Order is out for delivery',
    delivered: 'Order has been delivered',
    completed: 'Order completed',
    cancelled: 'Order was cancelled',
  };

  await createNotification({
    tenantId,
    userId,
    type: 'order_status',
    title: `Order ${orderNumber} ${newStatus}`,
    message: statusMessages[newStatus] || `Order status changed to ${newStatus}`,
    actionUrl: `/admin/orders/${orderId}`,
    metadata: { orderId, orderNumber, status: newStatus },
  });
}

// Low stock alert notifications
export async function notifyLowStock(
  tenantId: string,
  userIds: string[],
  productId: string,
  productName: string,
  currentStock: number,
  threshold: number
): Promise<void> {
  const notifications = userIds.map((userId) =>
    createNotification({
      tenantId,
      userId,
      type: 'stock',
      title: 'Low Stock Alert',
      message: `${productName} is running low (${currentStock} left, threshold: ${threshold})`,
      actionUrl: `/admin/products/${productId}`,
      metadata: { productId, productName, currentStock, threshold },
    })
  );

  await Promise.all(notifications);
}

// Delivery alert notifications
export async function notifyDeliveryAlert(
  tenantId: string,
  userId: string,
  deliveryId: string,
  deliveryNumber: string,
  alertType: 'late' | 'offline' | 'exception' | 'completed',
  message: string
): Promise<void> {
  const titles: Record<typeof alertType, string> = {
    late: 'Delivery Running Late',
    offline: 'Driver Offline',
    exception: 'Delivery Exception',
    completed: 'Delivery Completed',
  };

  await createNotification({
    tenantId,
    userId,
    type: 'delivery',
    title: titles[alertType],
    message,
    actionUrl: `/admin/deliveries/${deliveryId}`,
    metadata: { deliveryId, deliveryNumber, alertType },
  });
}

// Payment received notification
export async function notifyPaymentReceived(
  tenantId: string,
  userId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  paymentMethod: string
): Promise<void> {
  await createNotification({
    tenantId,
    userId,
    type: 'payment',
    title: 'Payment Received',
    message: `Payment of $${amount.toFixed(2)} received for order ${orderNumber} via ${paymentMethod}`,
    actionUrl: `/admin/orders/${orderId}`,
    metadata: { orderId, orderNumber, amount, paymentMethod },
  });
}

// Driver status change notifications
export async function notifyDriverStatusChange(
  tenantId: string,
  userId: string,
  driverId: string,
  driverName: string,
  newStatus: 'online' | 'offline' | 'on_delivery' | 'available'
): Promise<void> {
  const statusMessages: Record<typeof newStatus, string> = {
    online: 'Driver is now online',
    offline: 'Driver is now offline',
    on_delivery: 'Driver is on a delivery',
    available: 'Driver is available',
  };

  await createNotification({
    tenantId,
    userId,
    type: 'driver',
    title: `${driverName} status changed`,
    message: statusMessages[newStatus],
    actionUrl: `/admin/drivers/${driverId}`,
    metadata: { driverId, driverName, status: newStatus },
  });
}

// Menu expiring notification
export async function notifyMenuExpiring(
  tenantId: string,
  userIds: string[],
  menuId: string,
  menuName: string,
  expiresAt: string
): Promise<void> {
  const notifications = userIds.map((userId) =>
    createNotification({
      tenantId,
      userId,
      type: 'menu',
      title: 'Menu Expiring Soon',
      message: `${menuName} expires ${expiresAt}`,
      actionUrl: `/admin/menus/${menuId}`,
      metadata: { menuId, menuName, expiresAt },
    })
  );

  await Promise.all(notifications);
}

// New customer signup notification
export async function notifyNewCustomer(
  tenantId: string,
  userIds: string[],
  customerId: string,
  customerName: string,
  customerEmail: string
): Promise<void> {
  const notifications = userIds.map((userId) =>
    createNotification({
      tenantId,
      userId,
      type: 'customer',
      title: 'New Customer Signup',
      message: `${customerName} (${customerEmail}) just signed up`,
      actionUrl: `/admin/customers/${customerId}`,
      metadata: { customerId, customerName, customerEmail },
    })
  );

  await Promise.all(notifications);
}

// System maintenance notification
export async function notifySystemMaintenance(
  tenantId: string,
  userIds: string[],
  title: string,
  message: string,
  scheduledAt?: string
): Promise<void> {
  const notifications = userIds.map((userId) =>
    createNotification({
      tenantId,
      userId,
      type: 'system',
      title,
      message,
      metadata: { scheduledAt },
    })
  );

  await Promise.all(notifications);
}

// Invoice overdue notification
export async function notifyInvoiceOverdue(
  tenantId: string,
  userId: string,
  invoiceId: string,
  invoiceNumber: string,
  dueDate: string,
  amount: number
): Promise<void> {
  await createNotification({
    tenantId,
    userId,
    type: 'invoice',
    title: 'Invoice Overdue',
    message: `Invoice ${invoiceNumber} is overdue (due: ${dueDate}, amount: $${amount.toFixed(2)})`,
    actionUrl: `/admin/invoices/${invoiceId}`,
    metadata: { invoiceId, invoiceNumber, dueDate, amount },
  });
}

// Team member mention notification
export async function notifyMention(
  tenantId: string,
  userId: string,
  mentionedBy: string,
  mentionedByName: string,
  context: string,
  contextUrl: string
): Promise<void> {
  await createNotification({
    tenantId,
    userId,
    type: 'mention',
    title: `${mentionedByName} mentioned you`,
    message: context,
    actionUrl: contextUrl,
    metadata: { mentionedBy, mentionedByName },
  });
}
