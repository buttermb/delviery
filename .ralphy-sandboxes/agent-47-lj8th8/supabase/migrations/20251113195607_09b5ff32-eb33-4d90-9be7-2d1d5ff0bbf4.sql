-- Update subscription plan pricing to new structure
-- Basic: $79, Professional: $150, Enterprise: $499

UPDATE public.subscription_plans 
SET 
  price = 79,
  price_monthly = 79,
  description = 'Perfect for small businesses getting started. Includes 28 essential features for managing products, customers, and orders.',
  features = jsonb_build_array(
    '28 Core Features',
    '50 Customers',
    '100 Products', 
    '2 Locations',
    '3 Team Members',
    'Basic Analytics',
    'Email Support'
  ),
  limits = jsonb_build_object(
    'customers', 50,
    'products', 100,
    'locations', 2,
    'users', 3,
    'menus', 3
  )
WHERE name = 'starter';

UPDATE public.subscription_plans 
SET 
  price = 150,
  price_monthly = 150,
  description = 'Ideal for growing businesses. Includes 55 features with advanced CRM, marketing automation, and full analytics.',
  features = jsonb_build_array(
    'All Basic Features',
    '55 Total Features',
    '500 Customers',
    '1,000 Products',
    '5 Locations',
    '15 Team Members',
    'Advanced Analytics',
    'Quality Control',
    'Marketing Automation',
    'Priority Support'
  ),
  limits = jsonb_build_object(
    'customers', 500,
    'products', 1000,
    'locations', 5,
    'users', 15,
    'menus', 10
  )
WHERE name = 'professional';

UPDATE public.subscription_plans 
SET 
  price = 499,
  price_monthly = 499,
  description = 'Complete solution for large operations. All 87 features including fleet management, API access, and white-label branding.',
  features = jsonb_build_array(
    'All Professional Features',
    'All 87 Features',
    'Unlimited Customers',
    'Unlimited Products',
    'Unlimited Locations',
    'Unlimited Team Members',
    'Fleet Management',
    'Delivery Tracking',
    'API Access & Webhooks',
    'White Label Branding',
    'Custom Domain',
    'Workflow Automation',
    '24/7 Priority Support',
    'Dedicated Account Manager'
  ),
  limits = jsonb_build_object(
    'customers', -1,
    'products', -1,
    'locations', -1,
    'users', -1,
    'menus', -1
  )
WHERE name = 'enterprise';

-- Update MRR for existing tenants with new pricing
UPDATE public.tenants
SET mrr = 79
WHERE subscription_plan = 'starter';

UPDATE public.tenants
SET mrr = 150
WHERE subscription_plan = 'professional';

UPDATE public.tenants
SET mrr = 499
WHERE subscription_plan = 'enterprise';