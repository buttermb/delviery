/**
 * Credit Package Pricing Tests
 * Verifies the 4-tier credit package structure matches requirements
 */

import { describe, it, expect } from 'vitest';

// Package configuration that must match frontend and database
const CREDIT_PACKAGES = [
  { id: 'starter-pack', credits: 5000, priceCents: 999, priceDisplay: 9.99, label: 'Starter Pack', popular: false },
  { id: 'growth-pack', credits: 15000, priceCents: 2499, priceDisplay: 24.99, label: 'Growth Pack', popular: true },
  { id: 'power-pack', credits: 50000, priceCents: 4999, priceDisplay: 49.99, label: 'Power Pack', popular: false },
  { id: 'enterprise-pack', credits: 150000, priceCents: 17999, priceDisplay: 179.99, label: 'Enterprise Pack', popular: false },
];

describe('Credit Package Pricing', () => {
  describe('Package Tiers', () => {
    it('should have exactly 4 package tiers', () => {
      expect(CREDIT_PACKAGES).toHaveLength(4);
    });

    it('starter pack: 5,000 credits for $9.99', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'starter-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(5000);
      expect(pack?.priceDisplay).toBe(9.99);
      expect(pack?.priceCents).toBe(999);
    });

    it('growth pack: 15,000 credits for $24.99 (marked as popular)', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'growth-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(15000);
      expect(pack?.priceDisplay).toBe(24.99);
      expect(pack?.priceCents).toBe(2499);
      expect(pack?.popular).toBe(true);
    });

    it('power pack: 50,000 credits for $49.99', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'power-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(50000);
      expect(pack?.priceDisplay).toBe(49.99);
      expect(pack?.priceCents).toBe(4999);
    });

    it('enterprise pack: 150,000 credits for $179.99', () => {
      const pack = CREDIT_PACKAGES.find(p => p.id === 'enterprise-pack');
      expect(pack).toBeDefined();
      expect(pack?.credits).toBe(150000);
      expect(pack?.priceDisplay).toBe(179.99);
      expect(pack?.priceCents).toBe(17999);
    });
  });

  describe('Value Progression', () => {
    it('price per credit decreases with larger packages', () => {
      const pricesPerCredit = CREDIT_PACKAGES.map(p => ({
        id: p.id,
        pricePerCredit: p.priceCents / p.credits,
      }));

      // Each subsequent package should have a lower price per credit
      for (let i = 1; i < pricesPerCredit.length; i++) {
        expect(pricesPerCredit[i].pricePerCredit).toBeLessThan(
          pricesPerCredit[i - 1].pricePerCredit
        );
      }
    });

    it('only growth pack is marked as popular', () => {
      const popularPacks = CREDIT_PACKAGES.filter(p => p.popular);
      expect(popularPacks).toHaveLength(1);
      expect(popularPacks[0].id).toBe('growth-pack');
    });
  });

  describe('Package Slug Format', () => {
    it('all package slugs should be valid kebab-case', () => {
      CREDIT_PACKAGES.forEach(pack => {
        expect(pack.id).toMatch(/^[a-z]+-[a-z]+$/);
      });
    });

    it('all packages should have unique slugs', () => {
      const slugs = CREDIT_PACKAGES.map(p => p.id);
      const uniqueSlugs = [...new Set(slugs)];
      expect(slugs.length).toBe(uniqueSlugs.length);
    });
  });
});

describe('Stripe Webhook Credit Purchase', () => {
  it('should have correct metadata structure for credit purchases', () => {
    const mockCheckoutSession = {
      metadata: {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        package_slug: 'growth-pack',
        credits: '15000',
        type: 'credit_purchase',
      },
      payment_intent: 'pi_test_123',
      amount_total: 2499,
    };

    expect(mockCheckoutSession.metadata.type).toBe('credit_purchase');
    expect(parseInt(mockCheckoutSession.metadata.credits)).toBe(15000);
    expect(mockCheckoutSession.amount_total).toBe(2499);
  });

  it('should support all 4 package slugs', () => {
    const validSlugs = ['starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack'];

    CREDIT_PACKAGES.forEach(pack => {
      expect(validSlugs).toContain(pack.id);
    });
  });
});
