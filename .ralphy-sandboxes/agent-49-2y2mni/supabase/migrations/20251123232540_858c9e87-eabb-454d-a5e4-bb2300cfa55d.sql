-- Update Starter plan with correct limits
UPDATE subscription_plans 
SET 
  features = jsonb_build_array(
    'Up to 50 customers',
    '3 disposable menus',
    '100 products',
    '2 team members',
    '100 orders per month',
    'Email support',
    'Basic analytics'
  ),
  limits = jsonb_build_object(
    'customers', 50,
    'menus', 3,
    'products', 100,
    'users', 2,
    'orders', 100
  )
WHERE name = 'Starter';

-- Update Professional plan with correct limits
UPDATE subscription_plans 
SET 
  features = jsonb_build_array(
    'Up to 500 customers',
    'Unlimited disposable menus',
    '500 products',
    '10 team members',
    '1,000 orders per month',
    'Priority support',
    'Advanced analytics',
    'API access',
    'Custom branding'
  ),
  limits = jsonb_build_object(
    'customers', 500,
    'menus', -1,
    'products', 500,
    'users', 10,
    'orders', 1000
  )
WHERE name = 'Professional';

-- Update Enterprise plan with unlimited everything
UPDATE subscription_plans 
SET 
  features = jsonb_build_array(
    'Unlimited customers',
    'Unlimited disposable menus',
    'Unlimited products',
    'Unlimited team members',
    'Unlimited orders',
    '24/7 dedicated support',
    'Advanced analytics',
    'Full API access',
    'White label',
    'Custom integrations',
    'SLA guarantee'
  ),
  limits = jsonb_build_object(
    'customers', -1,
    'menus', -1,
    'products', -1,
    'users', -1,
    'orders', -1
  )
WHERE name = 'Enterprise';