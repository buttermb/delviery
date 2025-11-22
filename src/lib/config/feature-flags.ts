import { logger } from '@/lib/logger';

export interface FeatureFlags {
    enable_screenshot_protection: boolean;
    enable_redis_cache: boolean;
    enable_ai_security: boolean;
    enable_predictive_analytics: boolean;
    enable_realtime_dashboard: boolean;
}

export const defaultFlags: FeatureFlags = {
    enable_screenshot_protection: true,
    enable_redis_cache: false, // Progressive rollout
    enable_ai_security: false, // Enterprise only
    enable_predictive_analytics: false, // Pro tier
    enable_realtime_dashboard: true
};

export class FeatureFlagService {
    private static instance: FeatureFlagService;
    private flags: FeatureFlags;

    private constructor() {
        this.flags = { ...defaultFlags };
    }

    static getInstance(): FeatureFlagService {
        if (!FeatureFlagService.instance) {
            FeatureFlagService.instance = new FeatureFlagService();
        }
        return FeatureFlagService.instance;
    }

    isEnabled(flag: keyof FeatureFlags): boolean {
        return this.flags[flag];
    }

    // In a real app, this would fetch from LaunchDarkly or DB
    async fetchFlags(tenantId: string) {
        logger.debug(`Fetching feature flags for tenant ${tenantId}`);
        // Mock logic for progressive rollout
        if (tenantId === 'beta-tester') {
            this.flags.enable_redis_cache = true;
            this.flags.enable_ai_security = true;
        }
    }
}
