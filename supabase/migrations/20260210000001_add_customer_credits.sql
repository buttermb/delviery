-- ============================================================================
-- CUSTOMER CREDITS TABLE ENHANCEMENT
-- ============================================================================
-- This migration enhances the customer_credits table with additional columns
-- for tracking credit/debit transactions, reference linking, and balance history
-- as specified in task-136
-- ============================================================================

-- Add missing columns to customer_credits table
ALTER TABLE customer_credits
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('credit', 'debit')),
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on reference columns for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_credits_reference
  ON customer_credits(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- Create index on type for filtering credit vs debit
CREATE INDEX IF NOT EXISTS idx_customer_credits_type
  ON customer_credits(type);

-- Create index on balance_after for balance history queries
CREATE INDEX IF NOT EXISTS idx_customer_credits_balance_after
  ON customer_credits(customer_id, created_at DESC);

-- Create index on user_id for audit trail
CREATE INDEX IF NOT EXISTS idx_customer_credits_user_id
  ON customer_credits(user_id)
  WHERE user_id IS NOT NULL;

-- Add comment explaining table purpose
COMMENT ON TABLE customer_credits IS 'Tracks customer credit/debit transactions with balance history for tenant-specific credit systems';

-- Add column comments for clarity
COMMENT ON COLUMN customer_credits.type IS 'Transaction type: credit (adds to balance) or debit (subtracts from balance)';
COMMENT ON COLUMN customer_credits.reference_type IS 'Type of related entity (e.g., order, refund, payment, adjustment)';
COMMENT ON COLUMN customer_credits.reference_id IS 'UUID of the related entity';
COMMENT ON COLUMN customer_credits.balance_after IS 'Customer balance after this transaction was applied';
COMMENT ON COLUMN customer_credits.user_id IS 'User who created/authorized this transaction';

-- ============================================================================
-- FUNCTION: Calculate and update balance_after on insert
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_customer_credit_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(10,2);
BEGIN
  -- Get current balance from customer_credit_balance table
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM customer_credit_balance
  WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id;

  -- If no balance record exists, assume 0
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  -- Calculate new balance based on type
  IF NEW.type = 'credit' THEN
    NEW.balance_after := current_balance + ABS(NEW.amount);
  ELSIF NEW.type = 'debit' THEN
    NEW.balance_after := current_balance - ABS(NEW.amount);
  ELSE
    -- Fallback: use amount sign to determine direction
    NEW.balance_after := current_balance + NEW.amount;
  END IF;

  -- Update or insert the balance record
  INSERT INTO customer_credit_balance (tenant_id, customer_id, balance, updated_at)
  VALUES (NEW.tenant_id, NEW.customer_id, NEW.balance_after, NOW())
  ON CONFLICT (customer_id)
  DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic balance calculation
DROP TRIGGER IF EXISTS trigger_calculate_credit_balance ON customer_credits;
CREATE TRIGGER trigger_calculate_credit_balance
  BEFORE INSERT ON customer_credits
  FOR EACH ROW
  EXECUTE FUNCTION calculate_customer_credit_balance();

-- ============================================================================
-- COMPLETE: Customer credits table enhanced with all required columns
-- ============================================================================
