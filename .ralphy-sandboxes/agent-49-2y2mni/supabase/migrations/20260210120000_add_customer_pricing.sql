-- Migration: add_customer_pricing
-- Create tenant-aware customer_pricing table for special pricing rules
-- Supports customer-specific or group-specific pricing with percentage discount or fixed price
-- Includes date range support for promotional pricing

-- ============================================================================
-- Create customer_groups table first (dependency for customer_pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for customer_groups
CREATE INDEX IF NOT EXISTS idx_customer_groups_tenant_id ON public.customer_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_groups_name ON public.customer_groups(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_groups_tenant_name_unique ON public.customer_groups(tenant_id, name);

-- Enable RLS on customer_groups
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_groups
CREATE POLICY "customer_groups_tenant_isolation_select"
  ON public.customer_groups
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_groups_tenant_isolation_insert"
  ON public.customer_groups
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_groups_tenant_isolation_update"
  ON public.customer_groups
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_groups_tenant_isolation_delete"
  ON public.customer_groups
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Create customer_pricing table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_group_id UUID REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ensure at least one of customer_id or customer_group_id is set
  CONSTRAINT customer_pricing_target_check CHECK (
    (customer_id IS NOT NULL AND customer_group_id IS NULL) OR
    (customer_id IS NULL AND customer_group_id IS NOT NULL)
  ),

  -- Ensure discount_value is positive
  CONSTRAINT customer_pricing_discount_value_positive CHECK (discount_value >= 0),

  -- Ensure percentage discount doesn't exceed 100
  CONSTRAINT customer_pricing_percentage_max CHECK (
    discount_type != 'percentage' OR discount_value <= 100
  ),

  -- Ensure end_date is after start_date if both are set
  CONSTRAINT customer_pricing_date_range_check CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  )
);

-- Indexes for customer_pricing
CREATE INDEX idx_customer_pricing_tenant_id ON public.customer_pricing(tenant_id);
CREATE INDEX idx_customer_pricing_customer_id ON public.customer_pricing(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_customer_pricing_customer_group_id ON public.customer_pricing(tenant_id, customer_group_id) WHERE customer_group_id IS NOT NULL;
CREATE INDEX idx_customer_pricing_product_id ON public.customer_pricing(tenant_id, product_id);
CREATE INDEX idx_customer_pricing_active ON public.customer_pricing(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_customer_pricing_date_range ON public.customer_pricing(tenant_id, start_date, end_date);

-- Unique constraint to prevent duplicate pricing rules for same customer/group + product
CREATE UNIQUE INDEX idx_customer_pricing_customer_product_unique
  ON public.customer_pricing(tenant_id, customer_id, product_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX idx_customer_pricing_group_product_unique
  ON public.customer_pricing(tenant_id, customer_group_id, product_id)
  WHERE customer_group_id IS NOT NULL;

-- Enable RLS on customer_pricing
ALTER TABLE public.customer_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_pricing
CREATE POLICY "customer_pricing_tenant_isolation_select"
  ON public.customer_pricing
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_pricing_tenant_isolation_insert"
  ON public.customer_pricing
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_pricing_tenant_isolation_update"
  ON public.customer_pricing
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "customer_pricing_tenant_isolation_delete"
  ON public.customer_pricing
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_customer_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customer_pricing
DROP TRIGGER IF EXISTS trg_customer_pricing_updated_at ON public.customer_pricing;
CREATE TRIGGER trg_customer_pricing_updated_at
  BEFORE UPDATE ON public.customer_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_pricing_updated_at();

-- Trigger for customer_groups
DROP TRIGGER IF EXISTS trg_customer_groups_updated_at ON public.customer_groups;
CREATE TRIGGER trg_customer_groups_updated_at
  BEFORE UPDATE ON public.customer_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_pricing_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get applicable pricing for a customer on a product
CREATE OR REPLACE FUNCTION public.get_customer_product_pricing(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_product_id UUID,
  p_customer_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  discount_type TEXT,
  discount_value DECIMAL(10, 2),
  is_customer_specific BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.discount_type,
    cp.discount_value,
    (cp.customer_id IS NOT NULL) AS is_customer_specific
  FROM public.customer_pricing cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.product_id = p_product_id
    AND cp.is_active = true
    AND (cp.start_date IS NULL OR cp.start_date <= CURRENT_DATE)
    AND (cp.end_date IS NULL OR cp.end_date >= CURRENT_DATE)
    AND (
      cp.customer_id = p_customer_id
      OR (p_customer_group_id IS NOT NULL AND cp.customer_group_id = p_customer_group_id)
    )
  -- Prioritize customer-specific pricing over group pricing
  ORDER BY (cp.customer_id IS NOT NULL) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to calculate effective price for a product
CREATE OR REPLACE FUNCTION public.calculate_effective_price(
  p_original_price DECIMAL(10, 2),
  p_discount_type TEXT,
  p_discount_value DECIMAL(10, 2)
)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
  IF p_discount_type = 'percentage' THEN
    RETURN ROUND(p_original_price * (1 - p_discount_value / 100), 2);
  ELSE
    RETURN p_discount_value;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.customer_groups IS 'Customer groups for organizing customers and applying group-specific pricing';
COMMENT ON COLUMN public.customer_groups.tenant_id IS 'Tenant this group belongs to';
COMMENT ON COLUMN public.customer_groups.name IS 'Display name for the customer group';
COMMENT ON COLUMN public.customer_groups.description IS 'Optional description of the group';
COMMENT ON COLUMN public.customer_groups.is_active IS 'Whether this group is currently active';

COMMENT ON TABLE public.customer_pricing IS 'Custom pricing rules for specific customers or customer groups';
COMMENT ON COLUMN public.customer_pricing.tenant_id IS 'Tenant this pricing rule belongs to';
COMMENT ON COLUMN public.customer_pricing.customer_id IS 'Specific customer this pricing applies to (mutually exclusive with customer_group_id)';
COMMENT ON COLUMN public.customer_pricing.customer_group_id IS 'Customer group this pricing applies to (mutually exclusive with customer_id)';
COMMENT ON COLUMN public.customer_pricing.product_id IS 'Product this pricing rule applies to';
COMMENT ON COLUMN public.customer_pricing.discount_type IS 'Type of discount: percentage (off regular price) or fixed (set price)';
COMMENT ON COLUMN public.customer_pricing.discount_value IS 'Discount amount: percentage (0-100) or fixed price value';
COMMENT ON COLUMN public.customer_pricing.start_date IS 'Optional start date for promotional pricing';
COMMENT ON COLUMN public.customer_pricing.end_date IS 'Optional end date for promotional pricing';
COMMENT ON COLUMN public.customer_pricing.is_active IS 'Whether this pricing rule is currently active';

COMMENT ON FUNCTION public.get_customer_product_pricing IS 'Get applicable pricing rule for a customer on a product, prioritizing customer-specific over group pricing';
COMMENT ON FUNCTION public.calculate_effective_price IS 'Calculate the effective price given original price and discount';
