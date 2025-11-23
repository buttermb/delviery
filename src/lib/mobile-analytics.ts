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

        console.log('[Mobile Analytics]', event);

        // TODO: Send to your analytics provider (PostHog, Google Analytics, etc.)
        // sendToAnalyticsProvider(event);
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
