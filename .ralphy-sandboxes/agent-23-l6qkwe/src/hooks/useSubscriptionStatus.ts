/**
 * Centralized Subscription Status Hook
 * Provides explicit subscription state flags for conditional rendering
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { type SubscriptionTier } from '@/lib/featureConfig';
import { isTrial as checkIsTrial, isCancelled as checkIsCancelled } from '@/utils/subscriptionStatus';

export function useSubscriptionStatus() {
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
  const status = tenant?.subscription_status;
  
  // Use normalized utilities that handle spelling variants (trial/trialing, cancelled/canceled)
  const isTrialStatus = checkIsTrial(status);
  const isCancelledStatus = checkIsCancelled(status);
  
  // Check if trial is expired
  const isTrialExpired = isTrialStatus && 
                        tenant?.trial_ends_at && 
                        new Date(tenant.trial_ends_at) < new Date();
  
  return {
    // Explicit tier flags
    isEnterprise: currentTier === 'enterprise',
    isProfessional: currentTier === 'professional',
    isStarter: currentTier === 'starter',
    
    // Explicit status flags (use normalized utilities)
    isTrial: isTrialStatus,
    isActive: status === 'active',
    isSuspended: status === 'suspended',
    isCancelled: isCancelledStatus,
    isPastDue: status === 'past_due',
    
    // Computed flags
    hasActiveSubscription: status === 'active' || (isTrialStatus && !isTrialExpired),
    canUpgrade: currentTier !== 'enterprise' && status !== 'suspended' && !isCancelledStatus,
    canDowngrade: currentTier !== 'starter',
    needsPaymentMethod: !tenant?.payment_method_added && isTrialStatus,
    isTrialExpired,
    
    // Raw values
    currentTier,
    status,
    tenant,
  };
}
