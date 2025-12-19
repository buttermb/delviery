-- Insert sample subscription plans for platform billing (delete existing first to avoid duplicates)
DELETE FROM subscription_plans WHERE name IN ('starter', 'professional', 'enterprise');

INSERT INTO subscription_plans (name, display_name, description, price, price_monthly, features, limits, is_active)
VALUES 
  ('starter', 'Starter', 'Perfect for small operations', 29.00, 29.00, '["Basic reporting", "Email support", "Up to 100 orders/month"]', '{"orders": 100, "products": 50, "users": 2}', true),
  ('professional', 'Professional', 'For growing businesses', 99.00, 99.00, '["Advanced analytics", "Priority support", "Up to 1000 orders/month", "Custom branding"]', '{"orders": 1000, "products": 500, "users": 10}', true),
  ('enterprise', 'Enterprise', 'Unlimited power for your operation', 299.00, 299.00, '["Unlimited everything", "24/7 dedicated support", "White-label options", "Custom integrations", "API access"]', '{"orders": -1, "products": -1, "users": -1}', true);