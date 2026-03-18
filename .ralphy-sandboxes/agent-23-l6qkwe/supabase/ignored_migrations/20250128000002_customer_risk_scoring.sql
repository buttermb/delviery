-- Customer Risk Scoring System
-- Automatically calculates risk scores based on payment history

-- Add risk score and payment history to wholesale_clients
ALTER TABLE wholesale_clients 
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 75;

ALTER TABLE wholesale_clients 
ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

-- Function to calculate customer risk score
CREATE OR REPLACE FUNCTION calculate_customer_risk_score(customer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_orders INTEGER;
  late_payments INTEGER;
  avg_days_late FLOAT;
  current_overdue NUMERIC;
  score INTEGER := 100;
BEGIN
  -- Get payment statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_date > due_date),
    AVG(EXTRACT(DAY FROM payment_date - due_date)) FILTER (WHERE payment_date > due_date),
    COALESCE(SUM(total_amount) FILTER (
      WHERE (payment_status IN ('fronted', 'partial', 'unpaid') OR payment_status IS NULL)
      AND (due_date < NOW() OR payment_due_date < NOW())
    ), 0)
  INTO total_orders, late_payments, avg_days_late, current_overdue
  FROM wholesale_orders
  WHERE customer_id = calculate_customer_risk_score.customer_id;

  -- If no orders, return neutral score
  IF total_orders = 0 THEN 
    RETURN 50; 
  END IF;

  -- Calculate score deductions
  
  -- Deduct for late payments (10 points per late payment, max 30 points)
  score := score - LEAST(late_payments * 10, 30);

  -- Deduct for average days late (2 points per day, max 20 points)
  IF avg_days_late IS NOT NULL AND avg_days_late > 0 THEN
    score := score - LEAST(CAST(avg_days_late AS INTEGER) * 2, 20);
  END IF;

  -- Deduct for current overdue amount (25 points if any overdue)
  IF current_overdue > 0 THEN
    score := score - 25;
  END IF;

  -- Bonus for perfect record (10 points for 5+ orders with no late payments)
  IF late_payments = 0 AND total_orders >= 5 THEN
    score := score + 10;
  END IF;

  -- Cap score between 0 and 100
  RETURN GREATEST(0, LEAST(100, score));
END;
$$;

-- Function to update all customer risk scores
CREATE OR REPLACE FUNCTION update_all_risk_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE wholesale_clients
  SET risk_score = calculate_customer_risk_score(id)
  WHERE id IN (SELECT DISTINCT customer_id FROM wholesale_orders);
END;
$$;

-- Trigger to auto-update risk score when order payment changes
CREATE OR REPLACE FUNCTION update_customer_risk_score_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE wholesale_clients
    SET risk_score = calculate_customer_risk_score(NEW.customer_id)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger (if not exists)
DROP TRIGGER IF EXISTS trigger_update_risk_score ON wholesale_orders;
CREATE TRIGGER trigger_update_risk_score
AFTER INSERT OR UPDATE OF payment_status, payment_date, due_date, payment_due_date ON wholesale_orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_risk_score_trigger();

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_customer_risk_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_all_risk_scores() TO authenticated;

-- Add comments
COMMENT ON FUNCTION calculate_customer_risk_score IS 'Calculates risk score (0-100) for a customer based on payment history';
COMMENT ON FUNCTION update_all_risk_scores IS 'Updates risk scores for all customers with order history';
COMMENT ON COLUMN wholesale_clients.risk_score IS 'Customer risk score (0-100). Higher = lower risk. Auto-calculated based on payment history.';

-- Initial calculation for existing customers
-- Note: Run this manually after migration:
-- SELECT update_all_risk_scores();

