-- FloraIQ Database Seed File
-- Run this after applying migrations: supabase db push
-- Then run: psql YOUR_DATABASE_URL -f supabase/seed.sql
-- OR paste this in Supabase Dashboard → SQL Editor

-- ============================================
-- SUBSCRIPTION PLANS
-- ============================================
INSERT INTO subscription_plans (id, name, slug, description, price_monthly, features, limits, stripe_price_id, stripe_product_id, is_active, sort_order) VALUES
('9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf', 'Starter', 'starter', 'Perfect for small operations', 79, 
 '["Up to 50 customers","3 disposable menus","100 products","2 team members","100 orders per month","Email support","Basic analytics"]'::jsonb, 
 '{"menus":3,"users":2,"products":100,"customers":50,"orders_per_month":100}'::jsonb, 
 NULL, NULL, true, 1),

('d7e9e8a6-208d-4ed8-b861-d606d1fabe75', 'Professional', 'professional', 'For growing businesses', 150, 
 '["Up to 500 customers","Unlimited disposable menus","500 products","10 team members","1,000 orders per month","Priority support","Advanced analytics","API access","Custom branding"]'::jsonb, 
 '{"menus":-1,"users":10,"products":500,"customers":500,"orders_per_month":1000}'::jsonb, 
 NULL, NULL, true, 2),

('4827c227-18a4-4348-b6c9-3e57184e52e7', 'Enterprise', 'enterprise', 'Unlimited power for your operation', 499, 
 '["Unlimited customers","Unlimited disposable menus","Unlimited products","Unlimited team members","Unlimited orders","24/7 dedicated support","Advanced analytics","Full API access","White label","Custom integrations","SLA guarantee"]'::jsonb, 
 '{"menus":-1,"users":-1,"products":-1,"customers":-1,"orders_per_month":-1}'::jsonb, 
 NULL, NULL, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Note: stripe_price_id and stripe_product_id are NULL here
-- They will be populated when you run the setup-stripe-products edge function
-- or you can manually add them after creating products in Stripe

SELECT 'Seed completed! ' || COUNT(*) || ' subscription plans created.' as status FROM subscription_plans;

