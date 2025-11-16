/**
 * Hook to check feature access based on tenant subscription tier
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { 
  hasFeatureAccess as checkFeatureAccess, 
  getRequiredTier,
  getUpgradeRequirement,
  type FeatureId,
  type SubscriptionTier,
  TIER_NAMES,
  TIER_PRICES
} from '@/lib/featureConfig';

export function useFeatureAccess() {
  const { tenant } = useTenantAdminAuth();
  
  // Map subscription plan names to tiers
  const getTierFromPlan = (plan: string | undefined): SubscriptionTier => {
    if (!plan) return 'starter';
    
    const planLower = plan.toLowerCase();
    
    if (planLower.includes('enterprise') || planLower.includes('unlimited')) {
      return 'enterprise';
    }
    if (planLower.includes('professional') || planLower.includes('pro')) {
      return 'professional';
    }
    return 'starter';
  };
  
  // Check if subscription is valid
  const isSubscriptionValid = (): boolean => {
    if (!tenant) return false;
    
    const status = tenant.subscription_status;
    
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
  
  const currentTier = getTierFromPlan(tenant?.subscription_plan);
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
    
    // Check subscription validity first
    if (!subscriptionValid) {
      return false;
    }
    
    // Then check tier access
    return checkFeatureAccess(currentTier, featureId);
  };
  
  const getFeatureTier = (featureId: FeatureId): SubscriptionTier | null => {
    return getRequiredTier(featureId);
  };
  
  const checkUpgrade = (featureId: FeatureId) => {
    return getUpgradeRequirement(currentTier, featureId);
  };
  
  return {
    currentTier,
    currentTierName: TIER_NAMES[currentTier],
    currentTierPrice: TIER_PRICES[currentTier],
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
