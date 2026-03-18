-- Function to check if tenant has valid subscription
CREATE OR REPLACE FUNCTION public.check_tenant_subscription_valid(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_next_billing_date TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, trial_ends_at, next_billing_date
  INTO v_status, v_trial_ends_at, v_next_billing_date
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Block suspended/cancelled accounts
  IF v_status IN ('suspended', 'cancelled') THEN
    RETURN FALSE;
  END IF;
  
  -- Check trial expiration
  IF v_status = 'trial' AND v_trial_ends_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check past_due with grace period (7 days)
  IF v_status = 'past_due' AND v_next_billing_date IS NOT NULL THEN
    IF (v_next_billing_date + INTERVAL '7 days') < NOW() THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to prevent operations for invalid subscriptions
CREATE OR REPLACE FUNCTION public.prevent_invalid_subscription_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip check for system operations
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  IF NOT check_tenant_subscription_valid(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Subscription expired or invalid. Please update your billing to continue using this feature.';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to critical tables (orders, products, customers)
-- Orders table
DROP TRIGGER IF EXISTS check_subscription_before_order ON orders;
CREATE TRIGGER check_subscription_before_order
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_subscription_operations();

-- Products table
DROP TRIGGER IF EXISTS check_subscription_before_product ON products;
CREATE TRIGGER check_subscription_before_product
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_subscription_operations();

-- Customers table
DROP TRIGGER IF EXISTS check_subscription_before_customer ON customers;
CREATE TRIGGER check_subscription_before_customer
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_subscription_operations();

-- Wholesale orders table (if exists)
DROP TRIGGER IF EXISTS check_subscription_before_wholesale_order ON wholesale_orders;
CREATE TRIGGER check_subscription_before_wholesale_order
BEFORE INSERT ON wholesale_orders
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_subscription_operations();

-- POS transactions table (if exists)
DROP TRIGGER IF EXISTS check_subscription_before_pos_transaction ON pos_transactions;
CREATE TRIGGER check_subscription_before_pos_transaction
BEFORE INSERT ON pos_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_invalid_subscription_operations();

-- Add helpful comments
COMMENT ON FUNCTION public.check_tenant_subscription_valid IS 'Validates if a tenant has an active, valid subscription. Returns false for suspended, cancelled, or expired trials.';
COMMENT ON FUNCTION public.prevent_invalid_subscription_operations IS 'Trigger function that prevents operations when tenant subscription is invalid. Applies to critical business operations.';
