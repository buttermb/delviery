import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

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
                console.warn('Capacitor App plugin not found or failed to load:', pluginError);
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
                            console.log('Push received:', notification.title);
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
                console.warn('Push notifications not available:', pushError);
            }
        } catch (e) {
            console.error('Error initializing Capacitor', e);
        }
    }
};
