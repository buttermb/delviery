-- Credit System Hardening Migration
-- Adds database-level protections against common credit system vulnerabilities

-- 1. Add non-negative balance constraint to tenant_credits
ALTER TABLE public.tenant_credits 
ADD CONSTRAINT tenant_credits_balance_non_negative CHECK (balance >= 0);

-- 2. Add idempotency constraint for credit transactions
-- Prevents duplicate deductions for the same action+reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency 
ON public.credit_transactions (tenant_id, action_type, reference_id) 
WHERE reference_id IS NOT NULL AND action_type IS NOT NULL;

-- 3. Add unique constraint for purchase transactions (Stripe webhook protection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_purchase_idempotency 
ON public.credit_transactions (reference_id) 
WHERE transaction_type = 'purchase' AND reference_id IS NOT NULL;

-- 4. Create rate limiting function for credit operations
CREATE OR REPLACE FUNCTION public.check_credit_rate_limit(
  p_tenant_id UUID,
  p_window_minutes INTEGER DEFAULT 1,
  p_max_operations INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_operation_count
  FROM public.credit_transactions
  WHERE tenant_id = p_tenant_id
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  RETURN v_operation_count < p_max_operations;
END;
$$;

-- 5. Create abuse detection function
CREATE OR REPLACE FUNCTION public.detect_credit_abuse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
  v_rapid_same_action INTEGER;
BEGIN
  -- Check for high volume (more than 50 operations in 5 minutes)
  SELECT COUNT(*) INTO v_recent_count
  FROM public.credit_transactions
  WHERE tenant_id = NEW.tenant_id
    AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- Check for rapid same action (more than 10 of same action in 1 minute)
  SELECT COUNT(*) INTO v_rapid_same_action
  FROM public.credit_transactions
  WHERE tenant_id = NEW.tenant_id
    AND action_type = NEW.action_type
    AND created_at > NOW() - INTERVAL '1 minute';
  
  -- Log suspicious activity
  IF v_recent_count > 50 OR v_rapid_same_action > 10 THEN
    INSERT INTO public.credit_analytics (
      tenant_id,
      event_type,
      action_attempted,
      credits_at_event,
      metadata
    ) VALUES (
      NEW.tenant_id,
      'abuse_detected',
      NEW.action_type,
      NEW.balance_after,
      jsonb_build_object(
        'recent_count', v_recent_count,
        'rapid_same_action', v_rapid_same_action,
        'transaction_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger for abuse detection
DROP TRIGGER IF EXISTS trigger_detect_credit_abuse ON public.credit_transactions;
CREATE TRIGGER trigger_detect_credit_abuse
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_credit_abuse();

-- 7. Add daily credit usage tracking columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_credits' 
    AND column_name = 'credits_used_today'
  ) THEN
    ALTER TABLE public.tenant_credits 
    ADD COLUMN credits_used_today INTEGER DEFAULT 0,
    ADD COLUMN last_usage_reset_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 8. Create function to reset daily usage
CREATE OR REPLACE FUNCTION public.reset_daily_credit_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_credits
  SET 
    credits_used_today = 0,
    last_usage_reset_at = NOW()
  WHERE last_usage_reset_at < CURRENT_DATE;
END;
$$;