/**
 * useNotificationGate Hook
 *
 * Provides a gateway for features to check notification settings before
 * sending notifications. This hook connects to global settings and ensures
 * notifications respect user preferences.
 *
 * Usage:
 *   const { canSendNotification, sendNotification } = useNotificationGate();
 *
 *   // Check if notification type is enabled
 *   if (canSendNotification('lowStockAlerts')) {
 *     sendNotification({ type: 'lowStockAlerts', title: 'Low Stock', message: '...' });
 *   }
 */

import { useCallback, useMemo } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// Notification types that can be configured in settings
export type NotificationType =
  | 'emailNotifications'
  | 'smsNotifications'
  | 'lowStockAlerts'
  | 'overdueAlerts'
  | 'orderAlerts';

// Channel types for sending notifications
export type NotificationChannel = 'email' | 'sms' | 'push' | 'toast';

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  lowStockAlerts: boolean;
  overdueAlerts: boolean;
  orderAlerts: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  overdueAlerts: true,
  orderAlerts: true,
};

/**
 * Hook to gate notifications based on user preferences
 */
export function useNotificationGate() {
  const { accountSettings } = useAccount();

  // Get notification preferences from account settings
  const preferences = useMemo((): NotificationPreferences => {
    if (!accountSettings?.notification_settings) {
      return DEFAULT_PREFERENCES;
    }

    const settings = accountSettings.notification_settings as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...settings,
    };
  }, [accountSettings]);

  // Check if a specific notification type is enabled
  const canSendNotification = useCallback((type: NotificationType): boolean => {
    return preferences[type] ?? true;
  }, [preferences]);

  // Check if a channel is enabled
  const isChannelEnabled = useCallback((channel: NotificationChannel): boolean => {
    switch (channel) {
      case 'email':
        return preferences.emailNotifications;
      case 'sms':
        return preferences.smsNotifications;
      case 'toast':
        return true; // Toast notifications are always enabled
      case 'push':
        return true; // Push controlled separately
      default:
        return true;
    }
  }, [preferences]);

  // Send a notification respecting user preferences
  const sendNotification = useCallback((payload: NotificationPayload) => {
    const { type, title, message, channel = 'toast' } = payload;

    // Check if this notification type is enabled
    if (!canSendNotification(type)) {
      logger.debug('Notification blocked by user preferences', {
        type,
        component: 'useNotificationGate',
      });
      return false;
    }

    // Check if the channel is enabled
    if (!isChannelEnabled(channel)) {
      logger.debug('Notification channel disabled', {
        type,
        channel,
        component: 'useNotificationGate',
      });
      return false;
    }

    // Send the notification based on channel
    switch (channel) {
      case 'toast':
        toast(title, { description: message });
        break;
      case 'email':
        // Email would be handled by backend/edge function
        logger.debug('Email notification requested', { type, title, component: 'useNotificationGate' });
        break;
      case 'sms':
        // SMS would be handled by backend/edge function
        logger.debug('SMS notification requested', { type, title, component: 'useNotificationGate' });
        break;
      case 'push':
        // Push notification would use the Notification API
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body: message });
        }
        break;
    }

    logger.debug('Notification sent', {
      type,
      channel,
      component: 'useNotificationGate',
    });

    return true;
  }, [canSendNotification, isChannelEnabled]);

  // Convenience methods for common notification types
  const notifyLowStock = useCallback((productName: string, currentStock: number) => {
    return sendNotification({
      type: 'lowStockAlerts',
      title: 'Low Stock Alert',
      message: `${productName} is running low (${currentStock} remaining)`,
      channel: 'toast',
    });
  }, [sendNotification]);

  const notifyNewOrder = useCallback((orderId: string, customerName: string) => {
    return sendNotification({
      type: 'orderAlerts',
      title: 'New Order',
      message: `Order #${orderId} from ${customerName}`,
      channel: 'toast',
    });
  }, [sendNotification]);

  const notifyOverduePayment = useCallback((clientName: string, amount: number) => {
    return sendNotification({
      type: 'overdueAlerts',
      title: 'Overdue Payment',
      message: `Payment from ${clientName} is overdue ($${amount.toFixed(2)})`,
      channel: 'toast',
    });
  }, [sendNotification]);

  return {
    preferences,
    canSendNotification,
    isChannelEnabled,
    sendNotification,
    // Convenience methods
    notifyLowStock,
    notifyNewOrder,
    notifyOverduePayment,
  };
}

/**
 * Hook to check if a specific notification type is enabled
 * Useful for conditionally rendering notification-related UI
 */
export function useIsNotificationEnabled(type: NotificationType): boolean {
  const { canSendNotification } = useNotificationGate();
  return canSendNotification(type);
}
