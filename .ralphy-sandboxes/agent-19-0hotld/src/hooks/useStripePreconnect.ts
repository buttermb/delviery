import { useEffect } from 'react';

const STRIPE_PRECONNECT_ORIGINS = [
  'https://js.stripe.com',
  'https://api.stripe.com',
] as const;

/**
 * Adds <link rel="preconnect"> hints for Stripe domains when card payment is available.
 * Reduces connection latency when the user is redirected to Stripe Checkout.
 */
export function useStripePreconnect(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const links: HTMLLinkElement[] = [];

    for (const origin of STRIPE_PRECONNECT_ORIGINS) {
      // Skip if already present
      if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      for (const link of links) {
        link.remove();
      }
    };
  }, [enabled]);
}
