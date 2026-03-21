/**
 * BillingPage Pricing Verification Tests
 *
 * Ensures the BillingPage professional plan card displays the canonical
 * price from TIER_PRICES.professional (single source of truth in featureConfig).
 *
 * Guards against:
 * - Hardcoded price strings replacing the TIER_PRICES constant reference
 * - TIER_PRICES.professional drifting from the expected $150 value
 * - All three plan cards referencing their respective TIER_PRICES constants
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TIER_PRICES, TIER_NAMES } from '@/lib/featureConfig';

const billingPageSource = readFileSync(
  resolve(__dirname, '../BillingPage.tsx'),
  'utf-8'
);

describe('BillingPage pricing verification', () => {
  describe('TIER_PRICES constants', () => {
    it('professional tier price is $150', () => {
      expect(TIER_PRICES.professional).toBe(150);
    });

    it('starter tier price is $79', () => {
      expect(TIER_PRICES.starter).toBe(79);
    });

    it('enterprise tier price is $499', () => {
      expect(TIER_PRICES.enterprise).toBe(499);
    });

    it('TIER_NAMES match expected display names', () => {
      expect(TIER_NAMES.professional).toBe('Professional');
      expect(TIER_NAMES.starter).toBe('Starter');
      expect(TIER_NAMES.enterprise).toBe('Enterprise');
    });
  });

  describe('BillingPage source uses TIER_PRICES constants (not hardcoded)', () => {
    it('imports TIER_PRICES from featureConfig', () => {
      expect(billingPageSource).toMatch(/import\s+\{[^}]*TIER_PRICES[^}]*\}\s+from\s+['"]@\/lib\/featureConfig['"]/);
    });

    it('professional plan card references TIER_PRICES.professional', () => {
      expect(billingPageSource).toContain('TIER_PRICES.professional');
    });

    it('starter plan card references TIER_PRICES.starter', () => {
      expect(billingPageSource).toContain('TIER_PRICES.starter');
    });

    it('enterprise plan card references TIER_PRICES.enterprise', () => {
      expect(billingPageSource).toContain('TIER_PRICES.enterprise');
    });

    it('does not hardcode $150 for professional pricing', () => {
      // Ensure no hardcoded "$150" string exists in the source
      // (the price should come from TIER_PRICES.professional)
      const hardcodedProfessionalPrice = billingPageSource.match(/['"$]150['"]/g);
      expect(hardcodedProfessionalPrice).toBeNull();
    });

    it('does not hardcode $79 for starter pricing', () => {
      const hardcodedStarterPrice = billingPageSource.match(/['"$]79['"]/g);
      expect(hardcodedStarterPrice).toBeNull();
    });

    it('does not hardcode $499 for enterprise pricing', () => {
      const hardcodedEnterprisePrice = billingPageSource.match(/['"$]499['"]/g);
      expect(hardcodedEnterprisePrice).toBeNull();
    });
  });

  describe('professional plan card structure', () => {
    it('renders professional plan price with /mo suffix via template literal', () => {
      // The professional card should use ${TIER_PRICES.professional} in a JSX expression
      expect(billingPageSource).toMatch(/\$\{TIER_PRICES\.professional\}.*\/mo/);
    });

    it('professional plan card section exists with correct title', () => {
      expect(billingPageSource).toContain('{/* Professional Plan */}');
    });
  });
});
