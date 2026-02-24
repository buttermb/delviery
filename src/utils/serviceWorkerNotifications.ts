import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
/**
 * Show notification via service worker for home/lock screen support
 */
export async function showServiceWorkerNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: unknown;
    requireInteraction?: boolean;
  }
) {
  if (!('serviceWorker' in navigator)) {
    logger.debug('Service Worker not supported');
    return;
  }

  const permission = Notification.permission;
  if (permission !== 'granted') {
    logger.debug('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Show notification via service worker for persistent notifications
    await registration.showNotification(title, {
      body: options.body,
      tag: options.tag || 'default',
      icon: options.icon || '/logo.svg',
      badge: options.badge || '/logo.svg',
      data: options.data,
      requireInteraction: options.requireInteraction || false
    } as NotificationOptions);

    logger.debug('Service worker notification shown:', title);
  } catch (error) {
    logger.error('Error showing service worker notification:', error);
    
    // Fallback to regular notification
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: options.body,
        icon: options.icon || '/logo.svg',
        badge: options.badge || '/logo.svg',
        tag: options.tag
      });
    }
  }
}

/**
 * Notify courier of new order with home/lock screen support
 */
export async function notifyNewOrderPersistent(
  orderNumber: string,
  amount: number,
  borough: string
) {
  await showServiceWorkerNotification('New Delivery Order! 🚀', {
    body: `Order #${orderNumber} • ${formatCurrency(amount)} • ${borough}`,
    tag: `order-${orderNumber}`,
    requireInteraction: true,
    data: {
      type: 'new_order',
      orderNumber,
      amount,
      borough,
      url: '/courier-dashboard'
    }
  });
}

/**
 * Notify courier of delivery reminder
 */
export async function notifyDeliveryReminderPersistent(orderNumber: string) {
  await showServiceWorkerNotification('Delivery Reminder', {
    body: `Don't forget to complete Order #${orderNumber}`,
    tag: `reminder-${orderNumber}`,
    data: {
      type: 'delivery_reminder',
      orderNumber,
      url: '/courier-dashboard'
    }
  });
}

/**
 * Notify courier of earnings update
 */
export async function notifyEarningsUpdatePersistent(amount: number) {
  await showServiceWorkerNotification('Earnings Updated! 💰', {
    body: `You earned ${formatCurrency(amount)} from your last delivery`,
    tag: 'earnings-update',
    data: {
      type: 'earnings_update',
      amount,
      url: '/courier-earnings'
    }
  });
}
