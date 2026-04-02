-- ============================================================================
-- Fix Enterprise Pack Pricing
-- ============================================================================
-- Enterprise pack at $179.99 / 150,000 credits (0.12¢/credit) was more
-- expensive per-credit than Power pack at $49.99 / 50,000 (0.10¢/credit).
-- This violated the "BEST VALUE" badge and expected value progression.
--
-- Fix: lower enterprise price to $119.99 (0.08¢/credit) so it is genuinely
-- the best per-credit value across all tiers.
-- ============================================================================

UPDATE public.credit_packages
SET
  price_cents = 11999,
  description = '150,000 credits for $119.99 - Maximum savings',
  stripe_price_id = NULL,   -- Reset so a new Stripe price is created
  stripe_product_id = NULL,
  updated_at = now()
WHERE slug = 'enterprise-pack';
