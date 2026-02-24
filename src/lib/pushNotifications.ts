/**
 * Push Notifications Service
 * Handles native push notification registration and handling for Capacitor mobile apps.
 */

import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

// Types for push notification tokens
interface PushTokenResult {
    success: boolean;
    token?: string;
    error?: string;
}

interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

// Store the token for later use
let fcmToken: string | null = null;

/**
 * Initialize push notifications for mobile platforms
 * This should be called after user authentication
 */
export async function initializePushNotifications(): Promise<PushTokenResult> {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
        logger.debug('[PUSH] Not a native platform, skipping push initialization');
        return { success: false, error: 'Not a native platform' };
    }

    try {
        // Dynamically import to avoid errors on web
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Request permission
        const permissionStatus = await PushNotifications.requestPermissions();

        if (permissionStatus.receive !== 'granted') {
            logger.warn('[PUSH] Push notification permission denied');
            return { success: false, error: 'Permission denied' };
        }

        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration success
        return new Promise((resolve) => {
            PushNotifications.addListener('registration', (token) => {
                fcmToken = token.value;
                logger.info('[PUSH] Registration successful', { token: token.value.substring(0, 20) + '...' });
                resolve({ success: true, token: token.value });
            });

            PushNotifications.addListener('registrationError', (error) => {
                logger.error('[PUSH] Registration failed', error);
                resolve({ success: false, error: error.error || 'Registration failed' });
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                resolve({ success: false, error: 'Registration timeout' });
            }, 10000);
        });
    } catch (error) {
        logger.error('[PUSH] Failed to initialize push notifications', error);
        return { success: false, error: 'Initialization failed' };
    }
}

/**
 * Set up notification listeners for foreground and background notifications
 */
export async function setupNotificationListeners(
    onNotificationReceived?: (notification: NotificationPayload) => void,
    onNotificationTapped?: (notification: NotificationPayload) => void
): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Notification received while app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            logger.info('[PUSH] Notification received in foreground', {
                title: notification.title,
                body: notification.body,
            });

            if (onNotificationReceived) {
                onNotificationReceived({
                    title: notification.title || '',
                    body: notification.body || '',
                    data: notification.data,
                });
            }
        });

        // Notification was tapped by user
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            logger.info('[PUSH] Notification tapped', {
                actionId: action.actionId,
                data: action.notification.data,
            });

            if (onNotificationTapped) {
                onNotificationTapped({
                    title: action.notification.title || '',
                    body: action.notification.body || '',
                    data: action.notification.data,
                });
            }
        });

        logger.info('[PUSH] Notification listeners set up');
    } catch (error) {
        logger.error('[PUSH] Failed to set up notification listeners', error);
    }
}

/**
 * Get the current FCM token (if registered)
 */
export function getFCMToken(): string | null {
    return fcmToken;
}

/**
 * Register the FCM token with the backend for a specific user/tenant
 */
export async function registerTokenWithBackend(
    userId: string,
    tenantId: string
): Promise<boolean> {
    if (!fcmToken) {
        logger.warn('[PUSH] No FCM token available to register');
        return false;
    }

    try {
        const { supabase } = await import('@/integrations/supabase/client');

        // Upsert the device token
        const { error } = await (supabase as any)
            .from('push_tokens')
            .upsert({
                user_id: userId,
                tenant_id: tenantId,
                token: fcmToken,
                platform: Capacitor.getPlatform(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,tenant_id',
            });

        if (error) {
            logger.error('[PUSH] Failed to register token with backend', error);
            return false;
        }

        logger.info('[PUSH] Token registered with backend');
        return true;
    } catch (error) {
        logger.error('[PUSH] Failed to register token', error);
        return false;
    }
}

/**
 * Unregister push notifications (e.g., on logout)
 */
export async function unregisterPushNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.removeAllListeners();
        fcmToken = null;
        logger.info('[PUSH] Push notifications unregistered');
    } catch (error) {
        logger.error('[PUSH] Failed to unregister push notifications', error);
    }
}
