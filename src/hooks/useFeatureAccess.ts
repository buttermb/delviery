/**
 * Hook to check feature access based on tenant business tier
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  BUSINESS_TIER_PRESETS,
  getTierPreset,
  getNextTier,
  getTierRequirements,
  type BusinessTier
} from '@/lib/presets/businessTiers';
import { FEATURES, TIER_PRICES, type FeatureId } from '@/lib/featureConfig';

export function useFeatureAccess() {
  const { tenant } = useTenantAdminAuth();

  // Get current tier from tenant data, default to 'street'
  const currentTier: BusinessTier = (tenant?.business_tier as BusinessTier) || 'street';
  const preset = getTierPreset(currentTier);

  // Check if subscription is valid
  const isSubscriptionValid = (): boolean => {
    if (!tenant) return false;

    const status = tenant.subscription_status;

    // Guard: Null check for status
    if (!status) return false;

    // Blocked statuses
    if (status === 'suspended' || status === 'cancelled') {
      return false;
    }

    // Check trial expiration
    if (status === 'trial' && tenant.trial_ends_at) {
      const trialEnd = new Date(tenant.trial_ends_at);
      const now = new Date();
      if (trialEnd < now) {
        return false; // Trial expired
      }
    }

    // past_due gets 7-day grace period
    if (status === 'past_due' && tenant.next_billing_date) {
      const gracePeriodEnd = new Date(tenant.next_billing_date);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
      if (new Date() > gracePeriodEnd) {
        return false;
      }
    }

    return true;
  };

  const subscriptionValid = isSubscriptionValid();

  const isTrialExpired = tenant?.subscription_status === 'trial' &&
    tenant?.trial_ends_at &&
    new Date(tenant.trial_ends_at) < new Date();

  const isSuspended = tenant?.subscription_status === 'suspended';
  const isCancelled = tenant?.subscription_status === 'cancelled';
  const isPastDue = tenant?.subscription_status === 'past_due';

  const canAccess = (featureId: FeatureId): boolean => {
    // Always allow access to billing and settings
    if (featureId === 'billing' || featureId === 'settings') {
      return true;
    }

    // Guard: Check subscription validity first
    if (!subscriptionValid) {
      return false;
    }

    // Check if feature is enabled in the current tier preset
    if (preset.enabledFeatures.includes('all')) {
      // If 'all' is enabled, check if it's explicitly hidden
      return !preset.hiddenFeatures.includes(featureId);
    }

    return preset.enabledFeatures.includes(featureId);
  };

  const getFeatureTier = (featureId: FeatureId): BusinessTier | null => {
    // Find the lowest tier that has this feature
    const tiers: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];
    for (const tier of tiers) {
      const tierPreset = BUSINESS_TIER_PRESETS[tier];
      if (tierPreset.enabledFeatures.includes('all')) {
        if (!tierPreset.hiddenFeatures.includes(featureId)) return tier;
      } else if (tierPreset.enabledFeatures.includes(featureId)) {
        return tier;
      }
    }
    return null;
  };

  const checkUpgrade = (featureId: FeatureId) => {
    const hasAccess = canAccess(featureId);

    if (hasAccess) {
      return { required: false, targetTier: null, priceDifference: 0 };
    }

    const targetTier = getFeatureTier(featureId);

    // Calculate price difference (approximate based on revenue range or fixed pricing if we had it)
    // For now, returning 0 as pricing is dynamic/revenue based in this model
    // You might want to map tiers to base subscription prices if they exist

    return {
      required: true,
      targetTier,
      priceDifference: 0 // Placeholder
    };
  };

  return {
    currentTier,
    currentTierName: preset.displayName,
    currentTierEmoji: preset.emoji,
    canAccess,
    subscriptionValid,
    isTrialExpired,
    isSuspended,
    isCancelled,
    isPastDue,
    getFeatureTier,
    checkUpgrade,
    tenant,
  };
}
