/**
 * Checkout URL Format Tests
 * Verifies that success and cancel URLs for Stripe checkout sessions
 * use the correct tenant-scoped admin routes.
 */

import { describe, it, expect } from 'vitest';

/**
 * Mirrors the URL construction logic from:
 * - supabase/functions/start-trial/index.ts (lines 156-159)
 * - supabase/functions/create-checkout/index.ts (lines 135-138)
 */
function buildCheckoutUrls(
  origin: string,
  tenantSlug: string,
  skipTrial: boolean
): { successUrl: string; cancelUrl: string } {
  const successParams = skipTrial ? 'success=true' : 'success=true&trial=true';
  const successUrl = `${origin}/${tenantSlug}/admin/dashboard?${successParams}`;
  const cancelUrl = `${origin}/${tenantSlug}/admin/select-plan?canceled=true`;
  return { successUrl, cancelUrl };
}

describe('Checkout URL Format', () => {
  const origin = 'https://app.floraiq.com';
  const tenantSlug = 'acme-dispensary';

  describe('cancel URL', () => {
    it('should route to tenant admin select-plan page', () => {
      const { cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      expect(cancelUrl).toBe(
        'https://app.floraiq.com/acme-dispensary/admin/select-plan?canceled=true'
      );
    });

    it('should include tenant slug in the path', () => {
      const { cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      expect(cancelUrl).toContain(`/${tenantSlug}/admin/`);
    });

    it('should NOT route to bare /select-plan (saas page)', () => {
      const { cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      // The cancel URL must never be just /select-plan without the tenant slug prefix
      const url = new URL(cancelUrl);
      expect(url.pathname).not.toBe('/select-plan');
    });

    it('should NOT leak tenant_id in query params', () => {
      const { cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      const url = new URL(cancelUrl);
      expect(url.searchParams.has('tenant_id')).toBe(false);
    });

    it('should include canceled=true query param', () => {
      const { cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      const url = new URL(cancelUrl);
      expect(url.searchParams.get('canceled')).toBe('true');
    });

    it('should be the same format regardless of skip_trial', () => {
      const withTrial = buildCheckoutUrls(origin, tenantSlug, false);
      const withoutTrial = buildCheckoutUrls(origin, tenantSlug, true);
      expect(withTrial.cancelUrl).toBe(withoutTrial.cancelUrl);
    });
  });

  describe('success URL', () => {
    it('should route to tenant admin dashboard', () => {
      const { successUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      expect(successUrl).toBe(
        'https://app.floraiq.com/acme-dispensary/admin/dashboard?success=true&trial=true'
      );
    });

    it('should include trial=true param when not skipping trial', () => {
      const { successUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      const url = new URL(successUrl);
      expect(url.searchParams.get('trial')).toBe('true');
    });

    it('should NOT include trial param when skipping trial', () => {
      const { successUrl } = buildCheckoutUrls(origin, tenantSlug, true);
      const url = new URL(successUrl);
      expect(url.searchParams.has('trial')).toBe(false);
    });

    it('should include tenant slug in the path', () => {
      const { successUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      expect(successUrl).toContain(`/${tenantSlug}/admin/`);
    });
  });

  describe('URL consistency', () => {
    it('success and cancel URLs should use the same origin', () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      const successOrigin = new URL(successUrl).origin;
      const cancelOrigin = new URL(cancelUrl).origin;
      expect(successOrigin).toBe(cancelOrigin);
    });

    it('success and cancel URLs should use the same tenant slug prefix', () => {
      const { successUrl, cancelUrl } = buildCheckoutUrls(origin, tenantSlug, false);
      const successPath = new URL(successUrl).pathname;
      const cancelPath = new URL(cancelUrl).pathname;
      const tenantPrefix = `/${tenantSlug}/admin/`;
      expect(successPath.startsWith(tenantPrefix)).toBe(true);
      expect(cancelPath.startsWith(tenantPrefix)).toBe(true);
    });

    it('should handle slugs with hyphens', () => {
      const slug = 'my-green-shop-123';
      const { cancelUrl, successUrl } = buildCheckoutUrls(origin, slug, false);
      expect(cancelUrl).toContain(`/${slug}/admin/`);
      expect(successUrl).toContain(`/${slug}/admin/`);
    });

    it('should handle different origins', () => {
      const localOrigin = 'http://localhost:8080';
      const { cancelUrl, successUrl } = buildCheckoutUrls(localOrigin, tenantSlug, false);
      expect(cancelUrl.startsWith(localOrigin)).toBe(true);
      expect(successUrl.startsWith(localOrigin)).toBe(true);
    });
  });
});
