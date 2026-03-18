/**
 * Subscription Plan Constants
 * Central source of truth for subscription plan identifiers and features
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
        price: 0, // or whatever the price is
        limits: {
            customers: 50,
            menus: 3,
            products: 100,
            locations: 2,
            users: 3,
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
        price: 299,
        limits: {
            customers: 500,
            menus: -1, // Unlimited
            products: -1,
            locations: 10,
            users: 10,
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
        price: 799,
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
