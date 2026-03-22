import { describe, it, expect } from 'vitest';
import {
  type SubscriptionTier,
  TIER_PRICES,
  TIER_NAMES,
  TIER_TAGLINES,
  FEATURES,
} from '@/lib/featureConfig';
import {
  businessTierToSubscriptionTier,
  subscriptionTierToBusinessTier,
  getSubscriptionTierPrice,
  getSubscriptionTierName,
  isHigherTier,
  getUpgradePath,
} from '@/lib/tierMapping';
import {
  OPTIMIZED_SIDEBAR_SECTIONS,
  QUICK_ACTION_ITEMS,
  filterItemsByTier,
  getSidebarForTier,
  searchSidebarItems,
  getSidebarStats,
} from '@/lib/sidebar/optimizedSidebarConfig';

const VALID_TIERS: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];

describe('SubscriptionTier Type Consistency', () => {
  describe('Canonical tier values', () => {
    it('TIER_PRICES keys match valid subscription tiers', () => {
      const priceKeys = Object.keys(TIER_PRICES);
      expect(priceKeys).toEqual(expect.arrayContaining(VALID_TIERS));
      expect(priceKeys).toHaveLength(VALID_TIERS.length);
    });

    it('TIER_NAMES keys match valid subscription tiers', () => {
      const nameKeys = Object.keys(TIER_NAMES);
      expect(nameKeys).toEqual(expect.arrayContaining(VALID_TIERS));
      expect(nameKeys).toHaveLength(VALID_TIERS.length);
    });

    it('TIER_TAGLINES keys match valid subscription tiers', () => {
      const taglineKeys = Object.keys(TIER_TAGLINES);
      expect(taglineKeys).toEqual(expect.arrayContaining(VALID_TIERS));
      expect(taglineKeys).toHaveLength(VALID_TIERS.length);
    });

    it('all tier values are lowercase', () => {
      for (const tier of VALID_TIERS) {
        expect(tier).toBe(tier.toLowerCase());
      }
    });
  });

  describe('Tier mapping functions', () => {
    it('businessTierToSubscriptionTier returns only valid lowercase tiers', () => {
      const businessTiers = ['street', 'trap', 'block', 'hood', 'empire'];
      for (const bt of businessTiers) {
        const result = businessTierToSubscriptionTier(bt);
        expect(VALID_TIERS).toContain(result);
        expect(result).toBe(result.toLowerCase());
      }
    });

    it('businessTierToSubscriptionTier handles subscription tier pass-through', () => {
      expect(businessTierToSubscriptionTier('starter')).toBe('starter');
      expect(businessTierToSubscriptionTier('professional')).toBe('professional');
      expect(businessTierToSubscriptionTier('enterprise')).toBe('enterprise');
    });

    it('businessTierToSubscriptionTier returns starter for null/undefined', () => {
      expect(businessTierToSubscriptionTier(null)).toBe('starter');
      expect(businessTierToSubscriptionTier(undefined)).toBe('starter');
    });

    it('subscriptionTierToBusinessTier accepts only valid tiers', () => {
      for (const tier of VALID_TIERS) {
        const result = subscriptionTierToBusinessTier(tier);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('getSubscriptionTierPrice returns valid prices for each tier', () => {
      for (const tier of VALID_TIERS) {
        const price = getSubscriptionTierPrice(tier);
        expect(price).toBeGreaterThan(0);
        expect(price).toBe(TIER_PRICES[tier]);
      }
    });

    it('getSubscriptionTierName returns valid names for each tier', () => {
      for (const tier of VALID_TIERS) {
        const name = getSubscriptionTierName(tier);
        expect(name.length).toBeGreaterThan(0);
        expect(name).toBe(TIER_NAMES[tier]);
      }
    });

    it('isHigherTier correctly orders tiers', () => {
      expect(isHigherTier('professional', 'starter')).toBe(true);
      expect(isHigherTier('enterprise', 'professional')).toBe(true);
      expect(isHigherTier('enterprise', 'starter')).toBe(true);
      expect(isHigherTier('starter', 'professional')).toBe(false);
      expect(isHigherTier('starter', 'starter')).toBe(false);
    });

    it('getUpgradePath returns valid tiers or null', () => {
      expect(getUpgradePath('starter')).toBe('professional');
      expect(getUpgradePath('professional')).toBe('enterprise');
      expect(getUpgradePath('enterprise')).toBeNull();
    });
  });

  describe('Sidebar config tier consistency', () => {
    it('all sidebar nav items use valid lowercase tier values', () => {
      for (const section of OPTIMIZED_SIDEBAR_SECTIONS) {
        for (const item of section.items) {
          expect(
            VALID_TIERS,
            `Item "${item.name}" (${item.id}) has invalid tier: "${item.tier}"`
          ).toContain(item.tier);
          expect(item.tier).toBe(item.tier.toLowerCase());
        }
      }
    });

    it('QUICK_ACTION_ITEMS keys are valid lowercase tier values', () => {
      const keys = Object.keys(QUICK_ACTION_ITEMS);
      for (const key of keys) {
        expect(
          VALID_TIERS,
          `QUICK_ACTION_ITEMS has invalid key: "${key}"`
        ).toContain(key);
      }
      expect(keys).toHaveLength(VALID_TIERS.length);
    });

    it('filterItemsByTier works with valid lowercase tiers', () => {
      const allItems = OPTIMIZED_SIDEBAR_SECTIONS.flatMap(s => s.items);
      for (const tier of VALID_TIERS) {
        const filtered = filterItemsByTier(allItems, tier);
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.length).toBeLessThanOrEqual(allItems.length);
      }
    });

    it('starter tier returns fewer items than professional, which returns fewer than enterprise', () => {
      const allItems = OPTIMIZED_SIDEBAR_SECTIONS.flatMap(s => s.items);
      const starterCount = filterItemsByTier(allItems, 'starter').length;
      const proCount = filterItemsByTier(allItems, 'professional').length;
      const entCount = filterItemsByTier(allItems, 'enterprise').length;

      expect(starterCount).toBeLessThan(proCount);
      expect(proCount).toBeLessThan(entCount);
    });

    it('getSidebarForTier returns valid sections for each tier', () => {
      for (const tier of VALID_TIERS) {
        const sections = getSidebarForTier(tier);
        expect(sections.length).toBeGreaterThan(0);
        for (const section of sections) {
          expect(section.items.length).toBeGreaterThan(0);
        }
      }
    });

    it('searchSidebarItems returns items for known queries', () => {
      for (const tier of VALID_TIERS) {
        const results = searchSidebarItems('dashboard', tier);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('getSidebarStats returns valid counts for each tier', () => {
      for (const tier of VALID_TIERS) {
        const stats = getSidebarStats(tier);
        expect(stats.sections).toBeGreaterThan(0);
        expect(stats.items).toBeGreaterThan(0);
      }
    });
  });

  describe('Feature config tier consistency', () => {
    it('all features use valid lowercase tier values', () => {
      for (const [featureId, feature] of Object.entries(FEATURES)) {
        expect(
          VALID_TIERS,
          `Feature "${feature.name}" (${featureId}) has invalid tier: "${feature.tier}"`
        ).toContain(feature.tier);
        expect(feature.tier).toBe(feature.tier.toLowerCase());
      }
    });
  });

  describe('No uppercase tier values in data structures', () => {
    it('TIER_PRICES has no uppercase keys', () => {
      for (const key of Object.keys(TIER_PRICES)) {
        expect(key).toBe(key.toLowerCase());
      }
    });

    it('TIER_NAMES has no uppercase keys', () => {
      for (const key of Object.keys(TIER_NAMES)) {
        expect(key).toBe(key.toLowerCase());
      }
    });

    it('sidebar items have no uppercase tier values', () => {
      const allTiers = OPTIMIZED_SIDEBAR_SECTIONS
        .flatMap(s => s.items)
        .map(item => item.tier);

      for (const tier of allTiers) {
        expect(tier, `Found uppercase tier value: "${tier}"`).toBe(tier.toLowerCase());
      }
    });

    it('quick action items have no uppercase keys', () => {
      for (const key of Object.keys(QUICK_ACTION_ITEMS)) {
        expect(key, `Found uppercase QUICK_ACTION_ITEMS key: "${key}"`).toBe(key.toLowerCase());
      }
    });
  });
});
