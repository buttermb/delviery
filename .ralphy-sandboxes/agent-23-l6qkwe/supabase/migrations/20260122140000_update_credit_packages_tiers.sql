-- ============================================================================
-- Update Credit Packages to 4-Tier Structure
-- ============================================================================
-- Updates credit packages to match the required pricing:
-- - 5,000 credits - $9.99
-- - 15,000 credits - $24.99 (popular)
-- - 50,000 credits - $49.99
-- - 150,000 credits - $179.99
-- ============================================================================

-- Clear existing packages and insert new ones
DELETE FROM public.credit_packages
WHERE slug IN ('starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack');

-- Insert the 4 required credit packages
INSERT INTO public.credit_packages (name, slug, credits, price_cents, sort_order, badge, description, is_active)
VALUES
  ('Starter Pack', 'starter-pack', 5000, 999, 1, NULL, '5,000 credits for $9.99', true),
  ('Growth Pack', 'growth-pack', 15000, 2499, 2, 'POPULAR', '15,000 credits for $24.99 - Best for growing businesses', true),
  ('Power Pack', 'power-pack', 50000, 4999, 3, NULL, '50,000 credits for $49.99', true),
  ('Enterprise Pack', 'enterprise-pack', 150000, 17999, 4, 'BEST VALUE', '150,000 credits for $179.99 - Maximum savings', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  sort_order = EXCLUDED.sort_order,
  badge = EXCLUDED.badge,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  stripe_price_id = NULL,  -- Reset Stripe IDs so new prices are created
  stripe_product_id = NULL,
  updated_at = now();

-- Verify the packages are correct
DO $$
DECLARE
  package_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO package_count
  FROM public.credit_packages
  WHERE is_active = true AND slug IN ('starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack');

  IF package_count != 4 THEN
    RAISE EXCEPTION 'Expected 4 credit packages, found %', package_count;
  END IF;
END $$;
