import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

interface PushNotificationResult {
  success: boolean;
  token?: string;
}

interface PushNotification {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function initializePushNotifications(): Promise<PushNotificationResult> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false };
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permResult = await PushNotifications.requestPermissions();

    if (permResult.receive === 'granted') {
      await PushNotifications.register();
      return { success: true };
    }

    return { success: false };
  } catch (error) {
    logger.warn('Push notification initialization failed', error as Error, { component: 'pushNotifications' });
    return { success: false };
  }
}

export async function setupNotificationListeners(
  onReceive: (notification: PushNotification) => void,
  onTap: (notification: PushNotification) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      onReceive({
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      onTap({
        title: action.notification.title,
        body: action.notification.body,
        data: action.notification.data,
      });
    });
  } catch (error) {
    logger.warn('Push notification listeners setup failed', error as Error, { component: 'pushNotifications' });
  }
}
