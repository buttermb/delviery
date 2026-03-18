-- ============================================================================
-- Phase 3 P2 Fixes: POS Voids, Invoice Payments, Alert Snooze, License Alerts
-- ============================================================================

-- 1. POS Transaction Voids Tracking
CREATE TABLE IF NOT EXISTS public.pos_transaction_voids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.pos_transactions(id) ON DELETE CASCADE,
  voided_at TIMESTAMPTZ DEFAULT NOW(),
  voided_by UUID,
  reason TEXT NOT NULL,
  inventory_restored BOOLEAN DEFAULT true,
  original_items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_voids_tenant ON public.pos_transaction_voids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_voids_transaction ON public.pos_transaction_voids(transaction_id);

ALTER TABLE public.pos_transaction_voids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for pos_transaction_voids" ON public.pos_transaction_voids;
CREATE POLICY "Tenant isolation for pos_transaction_voids"
  ON public.pos_transaction_voids FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- Add voided status to pos_transactions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_transaction_status') THEN
    CREATE TYPE pos_transaction_status AS ENUM ('completed', 'voided', 'refunded', 'pending');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add voided_at column to pos_transactions
ALTER TABLE public.pos_transactions 
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- 2. Inventory Alert Snooze/Dismiss Persistence
ALTER TABLE public.inventory_alerts 
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dismissed_by UUID,
ADD COLUMN IF NOT EXISTS snooze_count INTEGER DEFAULT 0;

-- 3. Invoice Payment Tracking Enhancement
ALTER TABLE public.crm_invoices
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS overpayment_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_memo_id UUID;

-- 4. Cannabis License Expiration Tracking
ALTER TABLE public.wholesale_clients
ADD COLUMN IF NOT EXISTS license_expiration_date DATE,
ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'valid' CHECK (license_status IN ('valid', 'expiring_soon', 'expired', 'suspended')),
ADD COLUMN IF NOT EXISTS license_alerts_sent JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wholesale_clients_license_exp ON public.wholesale_clients(license_expiration_date) WHERE deleted_at IS NULL;

-- 5. License Expiration Alerts Table
CREATE TABLE IF NOT EXISTS public.license_expiration_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.wholesale_clients(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('30_day', '14_day', '7_day', 'expired')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);

CREATE INDEX IF NOT EXISTS idx_license_alerts_tenant ON public.license_expiration_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_license_alerts_client ON public.license_expiration_alerts(client_id);

ALTER TABLE public.license_expiration_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for license_expiration_alerts" ON public.license_expiration_alerts;
CREATE POLICY "Tenant isolation for license_expiration_alerts"
  ON public.license_expiration_alerts FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids_safe(auth.uid())));

-- ============================================================================
-- RPC Functions
-- ============================================================================

-- Void POS Transaction with Inventory Restoration
CREATE OR REPLACE FUNCTION public.void_pos_transaction(
  p_transaction_id UUID,
  p_reason TEXT,
  p_restore_inventory BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction RECORD;
  v_tenant_id UUID;
  v_item RECORD;
  v_void_id UUID;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM public.pos_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_transaction.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction already voided');
  END IF;

  v_tenant_id := v_transaction.tenant_id;

  -- Mark transaction as voided
  UPDATE public.pos_transactions
  SET voided_at = NOW(), void_reason = p_reason
  WHERE id = p_transaction_id;

  -- Restore inventory if requested
  IF p_restore_inventory AND v_transaction.items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_transaction.items)
    LOOP
      UPDATE public.products
      SET stock_quantity = stock_quantity + COALESCE((v_item.value->>'quantity')::INTEGER, 0)
      WHERE id = (v_item.value->>'product_id')::UUID
        AND tenant_id = v_tenant_id;
    END LOOP;
  END IF;

  -- Create void record
  INSERT INTO public.pos_transaction_voids (
    tenant_id, transaction_id, voided_by, reason, inventory_restored, original_items
  ) VALUES (
    v_tenant_id, p_transaction_id, auth.uid(), p_reason, p_restore_inventory, v_transaction.items
  ) RETURNING id INTO v_void_id;

  -- Update shift totals if applicable
  IF v_transaction.shift_id IS NOT NULL THEN
    UPDATE public.pos_shifts
    SET 
      refunds_amount = refunds_amount + v_transaction.total_amount,
      total_sales = total_sales - v_transaction.total_amount,
      total_transactions = total_transactions - 1
    WHERE id = v_transaction.shift_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'void_id', v_void_id,
    'amount_restored', v_transaction.total_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_pos_transaction TO authenticated;

-- Snooze Inventory Alert
CREATE OR REPLACE FUNCTION public.snooze_inventory_alert(
  p_alert_id UUID,
  p_snooze_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory_alerts
  SET 
    snoozed_until = NOW() + (p_snooze_hours || ' hours')::INTERVAL,
    snooze_count = snooze_count + 1
  WHERE id = p_alert_id;
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snooze_inventory_alert TO authenticated;

-- Dismiss Inventory Alert
CREATE OR REPLACE FUNCTION public.dismiss_inventory_alert(
  p_alert_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory_alerts
  SET 
    dismissed_at = NOW(),
    dismissed_by = auth.uid()
  WHERE id = p_alert_id;
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_inventory_alert TO authenticated;

-- Record Invoice Payment with Overpayment Handling
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_new_amount_paid NUMERIC;
  v_overpayment NUMERIC := 0;
  v_new_status TEXT;
  v_payment_entry JSONB;
BEGIN
  SELECT * INTO v_invoice
  FROM public.crm_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_amount;
  
  -- Check for overpayment
  IF v_new_amount_paid > v_invoice.total THEN
    v_overpayment := v_new_amount_paid - v_invoice.total;
    v_new_amount_paid := v_invoice.total;
  END IF;

  -- Determine new status
  IF v_new_amount_paid >= v_invoice.total THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_invoice.status;
  END IF;

  -- Create payment history entry
  v_payment_entry := jsonb_build_object(
    'amount', p_amount,
    'method', p_payment_method,
    'reference', p_reference,
    'recorded_at', NOW(),
    'recorded_by', auth.uid()
  );

  -- Update invoice
  UPDATE public.crm_invoices
  SET 
    amount_paid = v_new_amount_paid,
    overpayment_amount = v_overpayment,
    payment_history = COALESCE(payment_history, '[]'::jsonb) || v_payment_entry,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Update client open balance
  UPDATE public.crm_clients
  SET open_balance = GREATEST(0, open_balance - p_amount)
  WHERE id = v_invoice.client_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount_paid', v_new_amount_paid,
    'overpayment', v_overpayment,
    'new_status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_invoice_payment TO authenticated;

-- Check and Update License Statuses
CREATE OR REPLACE FUNCTION public.update_license_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Update expired licenses
  UPDATE public.wholesale_clients
  SET license_status = 'expired'
  WHERE license_expiration_date < CURRENT_DATE
    AND license_status != 'expired'
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update expiring soon (within 30 days)
  UPDATE public.wholesale_clients
  SET license_status = 'expiring_soon'
  WHERE license_expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND license_status = 'valid'
    AND deleted_at IS NULL;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_license_statuses TO authenticated;

-- Auto-clear alert snooze when stock replenished (trigger)
CREATE OR REPLACE FUNCTION public.auto_clear_alert_on_restock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_lbs > OLD.quantity_lbs OR NEW.quantity_units > OLD.quantity_units THEN
    UPDATE public.inventory_alerts
    SET 
      snoozed_until = NULL,
      is_resolved = CASE 
        WHEN NEW.quantity_lbs > COALESCE(NEW.reorder_point, 0) THEN true 
        ELSE is_resolved 
      END,
      resolved_at = CASE 
        WHEN NEW.quantity_lbs > COALESCE(NEW.reorder_point, 0) THEN NOW() 
        ELSE resolved_at 
      END
    WHERE product_id = NEW.id
      AND is_resolved = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_clear_alert_on_restock ON public.wholesale_inventory;
CREATE TRIGGER trigger_auto_clear_alert_on_restock
  AFTER UPDATE ON public.wholesale_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_clear_alert_on_restock();