import { getViewportSize, isMobile, isTouchDevice } from './utils/mobile';

type EventName =
    | 'pwa_install_prompt'
    | 'pwa_installed'
    | 'pwa_launch'
    | 'offline_mode'
    | 'online_mode'
    | 'share_api_used'
    | 'biometric_auth_used'
    | 'barcode_scan';

import { logger } from '@/lib/logger';

interface AnalyticsEvent {
    name: EventName;
    properties?: Record<string, any>;
    timestamp: number;
}

export const mobileAnalytics = {
    track(name: EventName, properties: Record<string, any> = {}) {
        const event: AnalyticsEvent = {
            name,
            properties: {
                ...properties,
                viewport: getViewportSize(),
                isMobile: isMobile(),
                isTouch: isTouchDevice(),
                displayMode: this.getDisplayMode(),
            },
            timestamp: Date.now(),
        };

        logger.info('[Mobile Analytics]', event, { component: 'MobileAnalytics' });

        // Placeholder for analytics provider integration
        // In the future, integrate with PostHog, Google Analytics, or similar
        if (process.env.NODE_ENV === 'production') {
            // sendToAnalyticsProvider(event);
            logger.debug('[Analytics] Event tracked (placeholder)', event, { component: 'MobileAnalytics' });
        }
    },

    getDisplayMode() {
        if (typeof window === 'undefined') return 'unknown';
        if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
        if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
        return 'browser';
    },

    init() {
        if (typeof window === 'undefined') return;

        // Track PWA launch
        if (this.getDisplayMode() === 'standalone') {
            this.track('pwa_launch');
        }

        // Track Install Prompt
        window.addEventListener('beforeinstallprompt', () => {
            this.track('pwa_install_prompt');
        });

        // Track App Installed
        window.addEventListener('appinstalled', () => {
            this.track('pwa_installed');
        });

        // Track Online/Offline
        window.addEventListener('offline', () => {
            this.track('offline_mode');
        });

        window.addEventListener('online', () => {
            this.track('online_mode');
        });
    }
};
