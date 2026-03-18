/**
 * Tier Type Mapping
 * 
 * Maps between BusinessTier (G-Wagon system) and SubscriptionTier (billing plans)
 * 
 * BusinessTier (5 tiers): street, trap, block, hood, empire
 * SubscriptionTier (3 tiers): starter ($79), professional ($150), enterprise ($499)
 * 
 * Mapping:
 * - street/trap → starter ($79)
 * - block/hood → professional ($150)
 * - empire → enterprise ($499)
 */

import { BusinessTier } from '@/lib/presets/businessTiers';
import { SubscriptionTier, TIER_PRICES, TIER_NAMES } from '@/lib/featureConfig';

/**
 * Map business tier to subscription tier for billing
 */
export function businessTierToSubscriptionTier(tier: BusinessTier | string | null | undefined): SubscriptionTier {
  switch (tier) {
    case 'street':
    case 'trap':
      return 'starter';
    case 'block':
    case 'hood':
      return 'professional';
    case 'empire':
      return 'enterprise';
    // Handle direct subscription tier values
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

/**
 * Get subscription tier price
 */
export function getSubscriptionTierPrice(tier: SubscriptionTier): number {
  return TIER_PRICES[tier];
}

/**
 * Get subscription tier display name
 */
export function getSubscriptionTierName(tier: SubscriptionTier): string {
  return TIER_NAMES[tier];
}

/**
 * Get tier display info including price
 */
export function getTierDisplayInfo(tier: SubscriptionTier): {
  name: string;
  price: number;
  priceDisplay: string;
} {
  return {
    name: TIER_NAMES[tier],
    price: TIER_PRICES[tier],
    priceDisplay: `$${TIER_PRICES[tier]}/mo`,
  };
}

/**
 * Check if tier A is higher than tier B
 */
export function isHigherTier(tierA: SubscriptionTier, tierB: SubscriptionTier): boolean {
  const hierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  return hierarchy.indexOf(tierA) > hierarchy.indexOf(tierB);
}

/**
 * Get the upgrade path from current tier
 */
export function getUpgradePath(currentTier: SubscriptionTier): SubscriptionTier | null {
  switch (currentTier) {
    case 'starter':
      return 'professional';
    case 'professional':
      return 'enterprise';
    case 'enterprise':
      return null; // Already at highest tier
    default:
      return 'professional';
  }
}
