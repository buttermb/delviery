-- Drop existing functions with correct signatures
DROP FUNCTION IF EXISTS public.consume_credits(uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.grant_free_credits(uuid, integer);

-- Add category column
ALTER TABLE public.credit_costs ADD COLUMN IF NOT EXISTS category TEXT;

-- Fix lifetime_earned
UPDATE public.tenant_credits SET lifetime_earned = GREATEST(balance, 500) WHERE lifetime_earned = 0 OR lifetime_earned IS NULL;

-- Create consume_credits
CREATE FUNCTION public.consume_credits(p_tenant_id UUID, p_action_key TEXT, p_reference_id TEXT DEFAULT NULL, p_reference_type TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER, credits_cost INTEGER, error_message TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cost INTEGER; v_current_balance INTEGER; v_new_balance INTEGER; v_is_free_tier BOOLEAN;
BEGIN
  SELECT COALESCE(credit_cost, 0) INTO v_cost FROM public.credit_costs WHERE action_key = p_action_key AND is_active = TRUE LIMIT 1;
  IF v_cost IS NULL THEN v_cost := 0; END IF;
  IF v_cost = 0 THEN RETURN QUERY SELECT TRUE, 0, 0, NULL::TEXT; RETURN; END IF;
  SELECT balance, is_free_tier INTO v_current_balance, v_is_free_tier FROM public.tenant_credits WHERE tenant_id = p_tenant_id;
  IF v_current_balance IS NULL THEN INSERT INTO public.tenant_credits (tenant_id, balance, is_free_tier, lifetime_earned) VALUES (p_tenant_id, 500, TRUE, 500) RETURNING balance, is_free_tier INTO v_current_balance, v_is_free_tier; END IF;
  IF NOT v_is_free_tier THEN RETURN QUERY SELECT TRUE, v_current_balance, 0, NULL::TEXT; RETURN; END IF;
  IF v_current_balance < v_cost THEN RETURN QUERY SELECT FALSE, v_current_balance, v_cost, 'Insufficient credits'::TEXT; RETURN; END IF;
  UPDATE public.tenant_credits SET balance = balance - v_cost, lifetime_spent = COALESCE(lifetime_spent, 0) + v_cost, updated_at = NOW() WHERE tenant_id = p_tenant_id RETURNING balance INTO v_new_balance;
  INSERT INTO public.credit_transactions (tenant_id, amount, balance_after, transaction_type, action_type, reference_id, reference_type, description) VALUES (p_tenant_id, -v_cost, v_new_balance, 'usage', p_action_key, p_reference_id, p_reference_type, COALESCE(p_description, 'Credit usage'));
  RETURN QUERY SELECT TRUE, v_new_balance, v_cost, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT FALSE, 0, 0, SQLERRM;
END; $$;

-- Create grant_free_credits  
CREATE FUNCTION public.grant_free_credits(p_tenant_id UUID, p_amount INTEGER DEFAULT 500)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER, error_message TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_balance INTEGER; v_now TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.tenant_credits (tenant_id, balance, is_free_tier, lifetime_earned, last_free_grant_at, next_free_grant_at) VALUES (p_tenant_id, p_amount, TRUE, p_amount, v_now, v_now + INTERVAL '30 days')
  ON CONFLICT (tenant_id) DO UPDATE SET balance = tenant_credits.balance + p_amount, lifetime_earned = tenant_credits.lifetime_earned + p_amount, last_free_grant_at = v_now, next_free_grant_at = v_now + INTERVAL '30 days', updated_at = v_now RETURNING balance INTO v_new_balance;
  INSERT INTO public.credit_transactions (tenant_id, amount, balance_after, transaction_type, description) VALUES (p_tenant_id, p_amount, v_new_balance, 'free_grant', 'Monthly credits');
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT FALSE, 0, SQLERRM;
END; $$;

-- Sync credit costs with category
INSERT INTO public.credit_costs (action_key, credit_cost, category, description, is_active) VALUES
('menu_create', 100, 'menus', 'Create menu', TRUE), ('menu_view', 2, 'menus', 'View menu', TRUE), ('pos_process_sale', 25, 'pos', 'Process sale', TRUE),
('order_create_manual', 50, 'orders', 'Create order', TRUE), ('menu_order_received', 75, 'orders', 'Menu order', TRUE),
('send_sms', 25, 'crm', 'Send SMS', TRUE), ('invoice_create', 50, 'invoices', 'Create invoice', TRUE), ('ai_insight_generate', 50, 'ai', 'AI insight', TRUE)
ON CONFLICT (action_key) DO UPDATE SET credit_cost = EXCLUDED.credit_cost, category = EXCLUDED.category, is_active = TRUE;

GRANT EXECUTE ON FUNCTION public.consume_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_free_credits TO authenticated;