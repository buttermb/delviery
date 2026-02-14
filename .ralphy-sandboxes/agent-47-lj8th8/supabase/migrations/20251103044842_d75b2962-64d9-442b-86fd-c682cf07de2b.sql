-- Create pos_transactions table with comprehensive fields
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Transaction details
  transaction_number TEXT NOT NULL UNIQUE,
  total_amount DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Payment details
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'digital_wallet', 'check', 'other')),
  payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending', 'refunded', 'failed')),
  
  -- Staff and terminal
  cashier_id UUID,
  cashier_name TEXT,
  terminal_id TEXT,
  shift_id UUID,
  
  -- Receipt
  receipt_number TEXT,
  
  -- Items (JSONB array for flexibility)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Customer info (optional)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by UUID,
  void_reason TEXT,
  
  -- Notes
  notes TEXT
);

-- Create pos_shifts table for shift management
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Shift details
  shift_number TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  cashier_id UUID NOT NULL,
  cashier_name TEXT NOT NULL,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Cash drawer
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  cash_difference DECIMAL(10,2),
  
  -- Totals
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  other_sales DECIMAL(10,2) DEFAULT 0,
  refunds_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- Z-report
  z_report JSONB,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_cash_drawer_events table for cash tracking
CREATE TABLE IF NOT EXISTS public.pos_cash_drawer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  shift_id UUID NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'close', 'add', 'remove', 'payout', 'deposit')),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  
  -- Staff
  performed_by UUID NOT NULL,
  performed_by_name TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant ON public.pos_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created ON public.pos_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_shift ON public.pos_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_cashier ON public.pos_transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_payment ON public.pos_transactions(payment_method, payment_status);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_tenant ON public.pos_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_status ON public.pos_shifts(status);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON public.pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_started ON public.pos_shifts(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_cash_drawer_shift ON public.pos_cash_drawer_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_drawer_tenant ON public.pos_cash_drawer_events(tenant_id);

-- Enable RLS
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_drawer_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_transactions
CREATE POLICY "Tenant admins can view their POS transactions"
  ON public.pos_transactions FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can insert their POS transactions"
  ON public.pos_transactions FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can update their POS transactions"
  ON public.pos_transactions FOR UPDATE
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for pos_shifts
CREATE POLICY "Tenant admins can view their shifts"
  ON public.pos_shifts FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can manage their shifts"
  ON public.pos_shifts FOR ALL
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS Policies for pos_cash_drawer_events
CREATE POLICY "Tenant admins can view their cash drawer events"
  ON public.pos_cash_drawer_events FOR SELECT
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can manage their cash drawer events"
  ON public.pos_cash_drawer_events FOR ALL
  USING (
    tenant_id IN (
      SELECT a.tenant_id FROM public.accounts a
      JOIN public.profiles p ON p.account_id = a.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Function to generate transaction number
CREATE OR REPLACE FUNCTION public.generate_pos_transaction_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- Function to generate shift number
CREATE OR REPLACE FUNCTION public.generate_shift_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SH-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate transaction number
CREATE OR REPLACE FUNCTION public.set_pos_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_number IS NULL THEN
    NEW.transaction_number := generate_pos_transaction_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pos_transaction_number_trigger
  BEFORE INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pos_transaction_number();

-- Trigger to auto-generate shift number
CREATE OR REPLACE FUNCTION public.set_shift_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_number IS NULL THEN
    NEW.shift_number := generate_shift_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_shift_number_trigger
  BEFORE INSERT ON public.pos_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shift_number();

-- Trigger to update shift totals when transaction is added
CREATE OR REPLACE FUNCTION public.update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shift_id IS NOT NULL AND NEW.payment_status = 'completed' THEN
    UPDATE public.pos_shifts
    SET 
      total_sales = total_sales + NEW.total_amount,
      total_transactions = total_transactions + 1,
      cash_sales = CASE WHEN NEW.payment_method = 'cash' THEN cash_sales + NEW.total_amount ELSE cash_sales END,
      card_sales = CASE WHEN NEW.payment_method = 'card' THEN card_sales + NEW.total_amount ELSE card_sales END,
      other_sales = CASE WHEN NEW.payment_method NOT IN ('cash', 'card') THEN other_sales + NEW.total_amount ELSE other_sales END,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shift_totals_trigger
  AFTER INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shift_totals();

-- Trigger for refunds
CREATE OR REPLACE FUNCTION public.handle_pos_refund()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status != 'refunded' THEN
    UPDATE public.pos_shifts
    SET 
      refunds_amount = refunds_amount + NEW.total_amount,
      updated_at = now()
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_pos_refund_trigger
  AFTER UPDATE ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pos_refund();