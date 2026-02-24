import { logger } from '@/lib/logger';

interface PushNotification {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
}

interface InitResult {
    success: boolean;
    token?: string;
}

/**
 * Initialize push notifications — requests permission on native platforms.
 */
export async function initializePushNotifications(): Promise<InitResult> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
            logger.info('Push notification permission not granted', { component: 'pushNotifications' });
            return { success: false };
        }

        await PushNotifications.register();

        return new Promise<InitResult>((resolve) => {
            PushNotifications.addListener('registration', (token) => {
                logger.info('Push registration success', { component: 'pushNotifications' });
                resolve({ success: true, token: token.value });
            });

            PushNotifications.addListener('registrationError', (error) => {
                logger.error('Push registration failed', error as unknown as Error, { component: 'pushNotifications' });
                resolve({ success: false });
            });

            // Timeout after 10s
            setTimeout(() => resolve({ success: false }), 10000);
        });
    } catch (error) {
        logger.warn('Push notifications not available on this platform', error as Error, { component: 'pushNotifications' });
        return { success: false };
    }
}

/**
 * Set up listeners for foreground and tapped notifications.
 */
export async function setupNotificationListeners(
    onForeground: (notification: PushNotification) => void,
    onTap: (notification: PushNotification) => void
): Promise<void> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            onForeground({
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
        logger.warn('Could not set up push notification listeners', error as Error, { component: 'pushNotifications' });
    }
}
