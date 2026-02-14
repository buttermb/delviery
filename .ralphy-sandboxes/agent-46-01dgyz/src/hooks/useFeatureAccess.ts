/**
 * useFeatureAccess Hook
 * 
 * Provides feature access checking based on tenant subscription tier.
 * Uses the simplified 3-tier subscription model: starter, professional, enterprise.
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  TIER_PRICES,
  TIER_NAMES,
  hasFeatureAccess,
  getRequiredTier,
  getUpgradeRequirement,
  isEssentialFeature,
  type FeatureId,
  type SubscriptionTier,
} from '@/lib/featureConfig';
import { isCancelled as checkIsCancelled } from '@/utils/subscriptionStatus';

// Map business tier (G-Wagon system) to subscription tier for backwards compatibility
function businessTierToSubscription(businessTier: string | null | undefined): SubscriptionTier {
  switch (businessTier) {
    case 'street':
    case 'trap':
      return 'starter';
    case 'block':
    case 'hood':
      return 'professional';
    case 'empire':
      return 'enterprise';
    // Direct subscription tier values
    case 'starter':
      return 'starter';
    case 'professional':
      return 'professional';
    case 'enterprise':
      return 'enterprise';
    default:
      return 'starter';
  }
}

export function useFeatureAccess() {
  const { tenant } = useTenantAdminAuth();

  // Determine current subscription tier
  // Check subscription_plan first, then business_tier for backwards compatibility
  const rawTier = tenant?.subscription_plan || tenant?.business_tier;
  const currentTier: SubscriptionTier = businessTierToSubscription(rawTier as string);

  // Check if subscription is valid
  const isSubscriptionValid = (): boolean => {
    if (!tenant) return false;

    const status = tenant.subscription_status;

    // Guard: Null check for status
    if (!status) return false;

    // Blocked statuses - no access (use utility for cancelled to handle spelling variants)
    if (status === 'suspended' || checkIsCancelled(status)) {
      return false;
    }

    // Check trial expiration - FIXED: Use UTC comparison to avoid timezone drift
    if (status === 'trial' && tenant.trial_ends_at) {
      const trialEndMs = new Date(tenant.trial_ends_at).getTime();
      const nowMs = Date.now();
      if (trialEndMs < nowMs) {
        return false; // Trial expired
      }
    }

    // past_due gets grace period (set by webhook in grace_period_ends_at)
    // FIXED: Use UTC comparison to avoid timezone drift
    if (status === 'past_due' && tenant.grace_period_ends_at) {
      const gracePeriodEndMs = new Date(tenant.grace_period_ends_at).getTime();
      const nowMs = Date.now();
      if (nowMs > gracePeriodEndMs) {
        return false; // Grace period expired - block access
      }
    }

    return true;
  };

  const subscriptionValid = isSubscriptionValid();

  // Subscription status flags - FIXED: Use UTC comparison
  const isTrialExpired = tenant?.subscription_status === 'trial' &&
    tenant?.trial_ends_at &&
    new Date(tenant.trial_ends_at).getTime() < Date.now();

  const isSuspended = tenant?.subscription_status === 'suspended';
  // Use normalized utility to handle both 'cancelled' and 'canceled' spellings
  const isCancelled = checkIsCancelled(tenant?.subscription_status);
  const isPastDue = tenant?.subscription_status === 'past_due';

  /**
   * Check if user can access a specific feature
   */
  const canAccess = (featureId: FeatureId): boolean => {
    // Essential features are always accessible
    if (isEssentialFeature(featureId)) {
      return true;
    }

    // Guard: Check subscription validity first
    if (!subscriptionValid) {
      return false;
    }

    // Check tier-based access
    return hasFeatureAccess(currentTier, featureId);
  };

  /**
   * Get the required tier for a feature
   */
  const getFeatureTier = (featureId: FeatureId): SubscriptionTier | null => {
    return getRequiredTier(featureId);
  };

  /**
   * Check if upgrade is required and get upgrade info
   */
  const checkUpgrade = (featureId: FeatureId) => {
    const hasAccess = canAccess(featureId);

    if (hasAccess) {
      return { required: false, targetTier: null, priceDifference: 0 };
    }

    const upgradeInfo = getUpgradeRequirement(currentTier, featureId);

    return {
      required: upgradeInfo.required,
      targetTier: upgradeInfo.targetTier,
      priceDifference: upgradeInfo.priceDifference,
    };
  };

  /**
   * Get display info for current tier
   */
  const getTierDisplayInfo = () => {
    return {
      name: TIER_NAMES[currentTier],
      price: TIER_PRICES[currentTier],
    };
  };

  return {
    // Current tier info
    currentTier,
    currentTierName: TIER_NAMES[currentTier],
    currentTierPrice: TIER_PRICES[currentTier],
    
    // Access checking
    canAccess,
    subscriptionValid,
    
    // Subscription status
    isTrialExpired,
    isSuspended,
    isCancelled,
    isPastDue,
    
    // Upgrade helpers
    getFeatureTier,
    checkUpgrade,
    getTierDisplayInfo,
    
    // Raw tenant for additional checks
    tenant,
  };
}

/**
 * Type export for components that need to type the hook return value
 */
export type UseFeatureAccessReturn = ReturnType<typeof useFeatureAccess>;
