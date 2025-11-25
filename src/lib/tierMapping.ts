/**
 * Tier Type Mapping
 * 
 * Maps between BusinessTier (feature-based) and SubscriptionTier (billing-based)
 * These are two separate but related tier systems:
 * - BusinessTier: street, trap, block, hood, empire (G-Wagon system)
 * - SubscriptionTier: starter, professional, enterprise (billing plans)
 */

import { BusinessTier } from '@/lib/presets/businessTiers';
import { SubscriptionTier } from '@/lib/featureConfig';

/**
 * Map business tier to subscription tier for billing
 */
export function businessTierToSubscriptionTier(tier: BusinessTier): SubscriptionTier {
  switch (tier) {
    case 'street':
    case 'trap':
      return 'starter';
    case 'block':
    case 'hood':
      return 'professional';
    case 'empire':
      return 'enterprise';
    default:
      return 'starter';
  }
}

/**
 * Map subscription tier to recommended business tier
 */
export function subscriptionTierToBusinessTier(tier: SubscriptionTier): BusinessTier {
  switch (tier) {
    case 'starter':
      return 'trap';
    case 'professional':
      return 'hood';
    case 'enterprise':
      return 'empire';
    default:
      return 'street';
  }
}
