/**
 * Start Trial Success URL Tests
 *
 * Verifies that the Stripe checkout success/cancel URLs include
 * the correct tenant slug so users land on the right dashboard
 * after completing payment.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic mirroring supabase/functions/start-trial/index.ts lines 156-159
// and supabase/functions/create-checkout/index.ts lines 135-138
// ---------------------------------------------------------------------------

interface Tenant {
  id: string;
  slug: string | null;
}

interface BuildCheckoutUrlsInput {
  origin: string;
  tenant: Tenant;
  skipTrial: boolean;
}

interface CheckoutUrls {
  successUrl: string;
  cancelUrl: string;
}

/**
 * Build Stripe checkout success/cancel URLs.
 * Throws if tenant.slug is falsy — callers must validate before invoking.
 */
function buildCheckoutUrls({ origin, tenant, skipTrial }: BuildCheckoutUrlsInput): CheckoutUrls {
  if (!tenant.slug) {
    throw new Error('Tenant configuration incomplete — missing slug');
  }

  const successParams = skipTrial ? 'success=true' : 'success=true&trial=true';
  const successUrl = `${origin}/${tenant.slug}/admin/dashboard?${successParams}`;
  const cancelUrl = `${origin}/select-plan?tenant_id=${tenant.id}&canceled=true`;

  return { successUrl, cancelUrl };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VALID_TENANT: Tenant = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  slug: 'green-leaf-co',
};

const ORIGIN = 'https://app.floraiq.com';

describe('Start Trial Success URL', () => {
  describe('success URL format', () => {
    it('should include the tenant slug in the success URL', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      expect(successUrl).toContain('/green-leaf-co/admin/dashboard');
    });

    it('should include trial=true param when not skipping trial', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      expect(successUrl).toBe(
        'https://app.floraiq.com/green-leaf-co/admin/dashboard?success=true&trial=true'
      );
    });

    it('should omit trial param when skipping trial', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: true,
      });

      expect(successUrl).toBe(
        'https://app.floraiq.com/green-leaf-co/admin/dashboard?success=true'
      );
      expect(successUrl).not.toContain('trial=true');
    });

    it('should use the provided origin', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: 'http://localhost:8080',
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      expect(successUrl.startsWith('http://localhost:8080/')).toBe(true);
    });

    it('should produce a valid URL with no double slashes after origin', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      // Ensure there's no "//" between origin and slug
      const afterProtocol = successUrl.replace('https://', '');
      expect(afterProtocol).not.toContain('//');
    });
  });

  describe('cancel URL format', () => {
    it('should include the tenant id as a query parameter', () => {
      const { cancelUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      expect(cancelUrl).toBe(
        `https://app.floraiq.com/select-plan?tenant_id=${VALID_TENANT.id}&canceled=true`
      );
    });

    it('should include canceled=true param', () => {
      const { cancelUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });

      expect(cancelUrl).toContain('canceled=true');
    });
  });

  describe('tenant slug validation', () => {
    it('should throw when tenant slug is null', () => {
      expect(() =>
        buildCheckoutUrls({
          origin: ORIGIN,
          tenant: { id: VALID_TENANT.id, slug: null },
          skipTrial: false,
        })
      ).toThrow('missing slug');
    });

    it('should throw when tenant slug is empty string', () => {
      expect(() =>
        buildCheckoutUrls({
          origin: ORIGIN,
          tenant: { id: VALID_TENANT.id, slug: '' },
          skipTrial: false,
        })
      ).toThrow('missing slug');
    });

    it('should work with hyphenated slugs', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: { id: VALID_TENANT.id, slug: 'my-awesome-store-123' },
        skipTrial: false,
      });

      expect(successUrl).toContain('/my-awesome-store-123/admin/dashboard');
    });

    it('should work with simple single-word slugs', () => {
      const { successUrl } = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: { id: VALID_TENANT.id, slug: 'acme' },
        skipTrial: false,
      });

      expect(successUrl).toContain('/acme/admin/dashboard');
    });
  });

  describe('edge cases', () => {
    it('should handle localhost origin', () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls({
        origin: 'http://localhost:5173',
        tenant: VALID_TENANT,
        skipTrial: true,
      });

      expect(successUrl).toBe(
        'http://localhost:5173/green-leaf-co/admin/dashboard?success=true'
      );
      expect(cancelUrl).toBe(
        `http://localhost:5173/select-plan?tenant_id=${VALID_TENANT.id}&canceled=true`
      );
    });

    it('should produce consistent URLs regardless of skip_trial for cancel URL', () => {
      const withTrial = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: false,
      });
      const withoutTrial = buildCheckoutUrls({
        origin: ORIGIN,
        tenant: VALID_TENANT,
        skipTrial: true,
      });

      expect(withTrial.cancelUrl).toBe(withoutTrial.cancelUrl);
    });
  });
});
