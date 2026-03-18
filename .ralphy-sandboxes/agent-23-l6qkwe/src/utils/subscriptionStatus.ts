export const SUBSCRIPTION_STATUS = {
    TRIAL: 'trial',
    TRIALING: 'trialing',
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELLED: 'cancelled',
    CANCELED: 'canceled', // Handle common typo
    SUSPENDED: 'suspended',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

/**
 * Checks if a subscription is considered active (including trial).
 * Normalizes 'trial' and 'trialing'.
 */
export const isActiveSubscription = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
        s === SUBSCRIPTION_STATUS.ACTIVE ||
        s === SUBSCRIPTION_STATUS.TRIAL ||
        s === SUBSCRIPTION_STATUS.TRIALING
    );
};

/**
 * Checks if a subscription is in trial mode.
 * Normalizes 'trial' and 'trialing'.
 */
export const isTrial = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
        s === SUBSCRIPTION_STATUS.TRIAL ||
        s === SUBSCRIPTION_STATUS.TRIALING
    );
};

/**
 * Checks if a subscription is cancelled.
 * Normalizes 'cancelled' and 'canceled'.
 */
export const isCancelled = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
        s === SUBSCRIPTION_STATUS.CANCELLED ||
        s === SUBSCRIPTION_STATUS.CANCELED
    );
};

/**
 * Returns a user-friendly label for the status.
 */
export const getSubscriptionStatusLabel = (status?: string | null): string => {
    if (!status) return 'Unknown';

    if (isTrial(status)) return 'Trial';
    if (isCancelled(status)) return 'Cancelled';

    const s = status.toLowerCase();
    switch (s) {
        case SUBSCRIPTION_STATUS.ACTIVE: return 'Active';
        case SUBSCRIPTION_STATUS.PAST_DUE: return 'Past Due';
        case SUBSCRIPTION_STATUS.SUSPENDED: return 'Suspended';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};
