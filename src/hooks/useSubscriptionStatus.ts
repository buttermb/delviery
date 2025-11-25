/**
 * Centralized Subscription Status Hook
 * Provides explicit subscription state flags for conditional rendering
 */

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { type SubscriptionTier } from '@/lib/featureConfig';

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
  
  // Check if trial is expired
  const isTrialExpired = status === 'trial' && 
                        tenant?.trial_ends_at && 
                        new Date(tenant.trial_ends_at) < new Date();
  
  return {
    // Explicit tier flags
    isEnterprise: currentTier === 'enterprise',
    isProfessional: currentTier === 'professional',
    isStarter: currentTier === 'starter',
    
    // Explicit status flags
    isTrial: status === 'trial',
    isActive: status === 'active',
    isSuspended: status === 'suspended',
    isCancelled: status === 'cancelled',
    isPastDue: status === 'past_due',
    
    // Computed flags
    hasActiveSubscription: status === 'active' || (status === 'trial' && !isTrialExpired),
    canUpgrade: currentTier !== 'enterprise' && status !== 'suspended' && status !== 'cancelled',
    canDowngrade: currentTier !== 'starter',
    needsPaymentMethod: !tenant?.payment_method_added && status === 'trial',
    isTrialExpired,
    
    // Raw values
    currentTier,
    status,
    tenant,
  };
}
