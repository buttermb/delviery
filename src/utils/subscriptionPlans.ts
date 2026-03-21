/**
 * Subscription Plan Constants
 * Must stay aligned with create_tenant_atomic() in the database
 * and TIER_PRICES in featureConfig.ts.
 *
 * Canonical prices (from planPricing.ts / featureConfig.ts):
 *   Starter:      $79/mo
 *   Professional: $150/mo
 *   Enterprise:   $499/mo
 */

export const SUBSCRIPTION_PLANS = {
    STARTER: 'starter',
    PROFESSIONAL: 'professional',
    ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS];

export const PLAN_FEATURES = {
    [SUBSCRIPTION_PLANS.STARTER]: {
        displayName: 'Starter',
        price: 79,
        limits: {
            customers: 200,
            menus: 10,
            products: 500,
            locations: 5,
            users: 10,
        },
        features: {
            api_access: false,
            custom_branding: false,
            white_label: false,
            advanced_analytics: false,
            sms_enabled: false,
        }
    },
    [SUBSCRIPTION_PLANS.PROFESSIONAL]: {
        displayName: 'Professional',
        price: 150,
        limits: {
            customers: 1000,
            menus: 50,
            products: 2000,
            locations: 20,
            users: 50,
        },
        features: {
            api_access: true,
            custom_branding: true,
            white_label: false,
            advanced_analytics: true,
            sms_enabled: true,
        }
    },
    [SUBSCRIPTION_PLANS.ENTERPRISE]: {
        displayName: 'Enterprise',
        price: 499,
        limits: {
            customers: -1,
            menus: -1,
            products: -1,
            locations: -1,
            users: -1,
        },
        features: {
            api_access: true,
            custom_branding: true,
            white_label: true,
            advanced_analytics: true,
            sms_enabled: true,
        }
    }
};

export const getPlanDetails = (planId: string) => {
    const normalizedPlan = planId?.toLowerCase() as SubscriptionPlan;
    return PLAN_FEATURES[normalizedPlan] || PLAN_FEATURES[SUBSCRIPTION_PLANS.STARTER];
};

export const isProfessionalOrHigher = (planId: string) => {
    return planId === SUBSCRIPTION_PLANS.PROFESSIONAL || planId === SUBSCRIPTION_PLANS.ENTERPRISE;
};

export const isEnterprise = (planId: string) => {
    return planId === SUBSCRIPTION_PLANS.ENTERPRISE;
};
