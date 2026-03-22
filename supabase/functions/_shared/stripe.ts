/**
 * Shared Stripe configuration for all edge functions.
 * Single source of truth for Stripe SDK version and API version.
 *
 * Usage:
 *   import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';
 *   const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
 */

export { default as Stripe } from "https://esm.sh/stripe@18.5.0?target=deno";

/** Pinned Stripe API version used across all edge functions. */
export const STRIPE_API_VERSION = "2025-08-27.basil" as const;
