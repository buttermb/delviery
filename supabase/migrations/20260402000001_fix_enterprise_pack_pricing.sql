-- Fix Enterprise Pack pricing to maintain strictly decreasing price-per-credit
-- across all tiers. Previous price ($179.99 / 150k credits = 0.12¢/credit) was
-- worse than Power Pack ($49.99 / 50k = 0.10¢/credit) despite being labeled
-- "BEST VALUE". New price: $119.99 / 150k = 0.08¢/credit.

UPDATE credit_packages
SET price_cents = 11999,
    description = '150,000 credits for $119.99 - Maximum savings',
    updated_at = now()
WHERE slug = 'enterprise-pack';
