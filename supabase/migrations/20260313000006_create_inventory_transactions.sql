-- ============================================================================
-- INVENTORY_TRANSACTIONS: Ledger-style stock tracking for all inventory changes
-- ============================================================================
-- Records every stock movement (purchase, sale, adjustment, transfer, return,
-- damage, count) as an immutable transaction row. Each row captures the
-- quantity_change (positive = stock in, negative = stock out), the running
-- balance, and who/what caused the change.
--
-- Replaces ad-hoc quantity updates scattered across triggers with a single
-- auditable ledger that can reconstruct stock levels at any point in time.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Transaction classification
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'purchase',     -- Stock received from supplier
      'sale',         -- Stock sold (retail or wholesale)
      'adjustment',   -- Manual inventory adjustment (over/short)
      'transfer_in',  -- Received from another location
      'transfer_out', -- Sent to another location
      'return',       -- Customer return adding stock back
      'damage',       -- Damaged / destroyed stock
      'count',        -- Physical count reconciliation
      'fronted',      -- Stock fronted (consignment out)
      'fronted_return' -- Fronted stock returned
    )
  ),

  -- Quantity & running balance
  quantity_change NUMERIC(10, 2) NOT NULL,           -- Positive = in, negative = out
  quantity_before NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Balance before this transaction
  quantity_after  NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Balance after this transaction
  unit TEXT NOT NULL DEFAULT 'units',                 -- units, lbs, oz, g, each

  -- Cost tracking
  cost_per_unit NUMERIC(10, 2),                      -- Unit cost at time of transaction
  total_cost    NUMERIC(10, 2),                      -- quantity_change * cost_per_unit

  -- Reference links (nullable — depends on transaction_type)
  order_id      UUID,                                -- FK to orders for sales/returns
  batch_id      UUID,                                -- FK to inventory_batches
  transfer_id   UUID,                                -- FK to inventory_transfers
  location_id   UUID,                                -- Warehouse / retail location
  supplier_name TEXT,                                 -- Supplier for purchases

  -- Audit
  performed_by  UUID REFERENCES auth.users(id),      -- Who performed the action
  notes         TEXT,                                 -- Free-text reason / memo
  reference_number TEXT,                             -- PO number, invoice number, etc.

  -- Timestamps
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory transactions in their tenant"
  ON public.inventory_transactions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert inventory transactions in their tenant"
  ON public.inventory_transactions FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- Transactions are immutable — no UPDATE or DELETE policies.
-- Corrections should be recorded as new adjustment transactions.

-- ============================================================================
-- Indexes
-- ============================================================================

-- Tenant isolation (required for RLS performance)
CREATE INDEX IF NOT EXISTS idx_inv_txn_tenant
  ON public.inventory_transactions(tenant_id);

-- Product stock history lookups
CREATE INDEX IF NOT EXISTS idx_inv_txn_product
  ON public.inventory_transactions(product_id);

-- Combined tenant + product (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_inv_txn_tenant_product
  ON public.inventory_transactions(tenant_id, product_id);

-- Time-series queries (recent transactions, date-range reports)
CREATE INDEX IF NOT EXISTS idx_inv_txn_date
  ON public.inventory_transactions(tenant_id, transaction_date DESC);

-- Filter by type (e.g. "show all sales", "show all adjustments")
CREATE INDEX IF NOT EXISTS idx_inv_txn_type
  ON public.inventory_transactions(tenant_id, transaction_type);

-- Order reference lookups (find transactions for a specific order)
CREATE INDEX IF NOT EXISTS idx_inv_txn_order
  ON public.inventory_transactions(order_id)
  WHERE order_id IS NOT NULL;

-- Batch reference lookups
CREATE INDEX IF NOT EXISTS idx_inv_txn_batch
  ON public.inventory_transactions(batch_id)
  WHERE batch_id IS NOT NULL;

-- Performer lookups (audit: what did this user do?)
CREATE INDEX IF NOT EXISTS idx_inv_txn_performed_by
  ON public.inventory_transactions(performed_by)
  WHERE performed_by IS NOT NULL;

-- ============================================================================
-- RPC: Record an inventory transaction with automatic balance tracking
-- ============================================================================
-- Atomically reads current stock, records the transaction with before/after
-- balances, and updates the product's available_quantity.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_inventory_transaction(
  p_tenant_id       UUID,
  p_product_id      UUID,
  p_transaction_type TEXT,
  p_quantity_change  NUMERIC,
  p_unit             TEXT DEFAULT 'units',
  p_cost_per_unit    NUMERIC DEFAULT NULL,
  p_order_id         UUID DEFAULT NULL,
  p_batch_id         UUID DEFAULT NULL,
  p_transfer_id      UUID DEFAULT NULL,
  p_location_id      UUID DEFAULT NULL,
  p_supplier_name    TEXT DEFAULT NULL,
  p_performed_by     UUID DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_qty NUMERIC;
  v_new_qty     NUMERIC;
  v_total_cost  NUMERIC;
  v_txn_id      UUID;
BEGIN
  -- Lock the product row to prevent concurrent stock updates
  SELECT COALESCE(available_quantity, 0)
    INTO v_current_qty
    FROM public.products
   WHERE id = p_product_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found for tenant %', p_product_id, p_tenant_id;
  END IF;

  v_new_qty := v_current_qty + p_quantity_change;
  v_total_cost := CASE
    WHEN p_cost_per_unit IS NOT NULL THEN ABS(p_quantity_change) * p_cost_per_unit
    ELSE NULL
  END;

  -- Insert the transaction record
  INSERT INTO public.inventory_transactions (
    tenant_id, product_id, transaction_type,
    quantity_change, quantity_before, quantity_after, unit,
    cost_per_unit, total_cost,
    order_id, batch_id, transfer_id, location_id, supplier_name,
    performed_by, notes, reference_number
  ) VALUES (
    p_tenant_id, p_product_id, p_transaction_type,
    p_quantity_change, v_current_qty, v_new_qty, p_unit,
    p_cost_per_unit, v_total_cost,
    p_order_id, p_batch_id, p_transfer_id, p_location_id, p_supplier_name,
    COALESCE(p_performed_by, auth.uid()), p_notes, p_reference_number
  )
  RETURNING id INTO v_txn_id;

  -- Update the product's available_quantity
  UPDATE public.products
     SET available_quantity = GREATEST(0, v_new_qty)
   WHERE id = p_product_id
     AND tenant_id = p_tenant_id;

  RETURN v_txn_id;
END;
$$;

-- Grant execute to authenticated users (RLS on the table still enforces tenant isolation)
GRANT EXECUTE ON FUNCTION public.record_inventory_transaction(
  UUID, UUID, TEXT, NUMERIC, TEXT, NUMERIC,
  UUID, UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT
) TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE public.inventory_transactions IS
  'Immutable ledger of all stock movements. Each row records a quantity change with before/after balances.';
COMMENT ON COLUMN public.inventory_transactions.quantity_change IS
  'Positive = stock in, negative = stock out';
COMMENT ON COLUMN public.inventory_transactions.quantity_before IS
  'Product available_quantity before this transaction';
COMMENT ON COLUMN public.inventory_transactions.quantity_after IS
  'Product available_quantity after this transaction';
COMMENT ON COLUMN public.inventory_transactions.transaction_type IS
  'Classification: purchase, sale, adjustment, transfer_in, transfer_out, return, damage, count, fronted, fronted_return';
COMMENT ON COLUMN public.inventory_transactions.cost_per_unit IS
  'Unit cost at time of transaction (nullable for non-purchase types)';
COMMENT ON COLUMN public.inventory_transactions.total_cost IS
  'Computed: abs(quantity_change) * cost_per_unit';
COMMENT ON COLUMN public.inventory_transactions.reference_number IS
  'External reference: PO number, invoice number, receipt ID, etc.';
