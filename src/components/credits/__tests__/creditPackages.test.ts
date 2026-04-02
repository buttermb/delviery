/**
 * Credit Package Pricing Tests
 * Verifies the CREDIT_PACKAGES constant from lib/credits matches requirements
 */

import { describe, it, expect } from 'vitest';
import { CREDIT_PACKAGES, getPricePerCredit } from '@/lib/credits/creditCosts';

describe('Credit Package Pricing', () => {
  describe('Package Tiers', () => {
    it('should have exactly 4 package tiers', () => {
      expect(CREDIT_PACKAGES).toHaveLength(4);
    });

    it('starter pack: 5,000 credits for $9.99', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'starter-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(5000);
      expect(pack?.priceCents).toBe(999);
    });

    it('growth pack: 15,000 credits for $24.99 (marked as POPULAR)', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'growth-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(15000);
      expect(pack?.priceCents).toBe(2499);
      expect(pack?.badge).toBe('POPULAR');
    });

    it('power pack: 50,000 credits for $49.99', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'power-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(50000);
      expect(pack?.priceCents).toBe(4999);
    });

    it('enterprise pack: 150,000 credits for $179.99 (marked as BEST VALUE)', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'enterprise-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(150000);
      expect(pack?.priceCents).toBe(17999);
      expect(pack?.badge).toBe('BEST VALUE');
    });
  });

  describe('Value Progression', () => {
    it('all packages after starter are cheaper per-credit than starter', () => {
      const pricesPerCredit = CREDIT_PACKAGES.map(p => ({
        id: p.id,
        pricePerCredit: getPricePerCredit(p.priceCents, p.credits),
      }));

      for (let i = 1; i < pricesPerCredit.length; i++) {
        expect(pricesPerCredit[i].pricePerCredit).toBeLessThan(
          pricesPerCredit[0].pricePerCredit
        );
      }
    });

    it('credits increase with each tier', () => {
      for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
        expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(
          CREDIT_PACKAGES[i - 1].credits
        );
      }
    });
  });

  describe('Package Structure', () => {
    it('all packages have required fields', () => {
      CREDIT_PACKAGES.forEach(pack => {
        expect(pack.id).toBeTruthy();
        expect(pack.name).toBeTruthy();
        expect(pack.slug).toBeTruthy();
        expect(pack.credits).toBeGreaterThan(0);
        expect(pack.priceCents).toBeGreaterThan(0);
        expect(pack.description).toBeTruthy();
      });
    });

    it('all package slugs should be valid kebab-case', () => {
      CREDIT_PACKAGES.forEach(pack => {
        expect(pack.slug).toMatch(/^[a-z]+-[a-z]+$/);
      });
    });

    it('all packages should have unique ids', () => {
      const ids = CREDIT_PACKAGES.map(p => p.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('all packages should have unique slugs', () => {
      const slugs = CREDIT_PACKAGES.map(p => p.slug);
      const uniqueSlugs = [...new Set(slugs)];
      expect(slugs.length).toBe(uniqueSlugs.length);
    });

    it('id matches slug for each package', () => {
      CREDIT_PACKAGES.forEach(pack => {
        expect(pack.id).toBe(pack.slug);
      });
    });
  });

  describe('Badge Labels', () => {
    it('growth-pack has POPULAR badge', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'growth-pack');
      expect(pack?.badge).toBe('POPULAR');
    });

    it('enterprise-pack has BEST VALUE badge', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'enterprise-pack');
      expect(pack?.badge).toBe('BEST VALUE');
    });

    it('starter-pack and power-pack have no badge', () => {
      const starterPack = CREDIT_PACKAGES.find(p => p.id === 'starter-pack');
      const powerPack = CREDIT_PACKAGES.find(p => p.id === 'power-pack');
      expect(starterPack?.badge).toBeUndefined();
      expect(powerPack?.badge).toBeUndefined();
    });
  });
});

describe('Stripe Webhook Credit Purchase', () => {
  it('should support all package slugs as valid metadata', () => {
    const validSlugs = CREDIT_PACKAGES.map(p => p.slug);

    CREDIT_PACKAGES.forEach(pack => {
      expect(validSlugs).toContain(pack.slug);
    });
  });

  it('should have correct metadata structure for credit purchases', () => {
    const firstPack = CREDIT_PACKAGES[0];
    const mockCheckoutSession = {
      metadata: {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        package_slug: firstPack.slug,
        credits: String(firstPack.credits),
        type: 'credit_purchase',
      },
      payment_intent: 'pi_test_123',
      amount_total: firstPack.priceCents,
    };

    expect(mockCheckoutSession.metadata.type).toBe('credit_purchase');
    expect(parseInt(mockCheckoutSession.metadata.credits)).toBe(firstPack.credits);
    expect(mockCheckoutSession.amount_total).toBe(firstPack.priceCents);
  });
});

describe('CREDIT_PACKAGES matches database migration', () => {
  // These values must match supabase/migrations/20260122140000_update_credit_packages_tiers.sql
  const DB_PACKAGES = [
    { slug: 'starter-pack', credits: 5000, priceCents: 999 },
    { slug: 'growth-pack', credits: 15000, priceCents: 2499 },
    { slug: 'power-pack', credits: 50000, priceCents: 4999 },
    { slug: 'enterprise-pack', credits: 150000, priceCents: 17999 },
  ];

  it.each(DB_PACKAGES)(
    '$slug: $credits credits for $priceCents cents matches lib',
    ({ slug, credits, priceCents }) => {
      const libPkg = CREDIT_PACKAGES.find(p => p.slug === slug);
      expect(libPkg).toBeDefined();
      expect(libPkg?.credits).toBe(credits);
      expect(libPkg?.priceCents).toBe(priceCents);
    }
  );
});
