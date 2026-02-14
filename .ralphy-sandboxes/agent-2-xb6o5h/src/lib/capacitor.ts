import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { logger } from '@/lib/logger';

export const initCapacitor = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            // Hide splash screen (it might auto-hide, but explicit is good)
            await SplashScreen.hide();

            // Set status bar style
            await StatusBar.setStyle({ style: Style.Dark });

            // Deep Linking Listener
            try {
                const { App } = await import('@capacitor/app');
                App.addListener('appUrlOpen', (event) => {
                    const slug = event.url.split('.app').pop();
                    if (slug) {
                        window.location.href = slug;
                    }
                });
            } catch (pluginError) {
                logger.warn('Capacitor App plugin not found or failed to load', pluginError as Error, { component: 'capacitor' });
            }

            // Initialize Push Notifications (only request permission, full setup after auth)
            try {
                const { initializePushNotifications, setupNotificationListeners } = await import('@/lib/pushNotifications');
                const result = await initializePushNotifications();
                if (result.success) {
                    // Set up listeners for foreground notifications
                    await setupNotificationListeners(
                        (notification) => {
                            // Handle foreground notification (could show a toast)
                            logger.info('Push received', { title: notification.title, component: 'capacitor' });
                        },
                        (notification) => {
                            // Handle notification tap - navigate based on data
                            if (notification.data?.route) {
                                window.location.href = notification.data.route as string;
                            }
                        }
                    );
                }
            } catch (pushError) {
                logger.warn('Push notifications not available', pushError as Error, { component: 'capacitor' });
            }
        } catch (e) {
            logger.error('Error initializing Capacitor', e as Error, { component: 'capacitor' });
        }
    }
};
