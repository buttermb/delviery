-- Ensure subscription_plans is publicly readable (for plan selection pages)
DROP POLICY IF EXISTS "Allow read access to subscription_plans" ON subscription_plans;

CREATE POLICY "Anyone can read subscription plans"
ON subscription_plans
FOR SELECT
USING (true);