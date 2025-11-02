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
  
  const currentTier = getTierFromPlan(tenant?.subscription_plan);
  
  // Debug logging
  console.log('🔍 Feature Access Debug:', {
    tenant_id: tenant?.id,
    subscription_plan: tenant?.subscription_plan,
    currentTier,
    tenant_full: tenant
  });
  
  const canAccess = (featureId: FeatureId): boolean => {
    const hasAccess = checkFeatureAccess(currentTier, featureId);
    console.log('🔐 Check Access:', { featureId, currentTier, hasAccess });
    return hasAccess;
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
    getFeatureTier,
    checkUpgrade,
    tenant,
  };
}
