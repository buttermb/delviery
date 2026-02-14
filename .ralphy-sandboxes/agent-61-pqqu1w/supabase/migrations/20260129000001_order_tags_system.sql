-- ============================================================================
-- ORDER TAGS SYSTEM
-- Normalized tag management for custom categorization of orders
-- Follows the same pattern as customer_tags system
-- ============================================================================

-- 1. Order Tags junction table - many-to-many between unified_orders and tags
-- Reuses the existing tags table for tag definitions
CREATE TABLE IF NOT EXISTS public.order_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.unified_orders(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT order_tags_unique UNIQUE (order_id, tag_id)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_tags_tenant_id ON public.order_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_tags_order_id ON public.order_tags(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tags_tag_id ON public.order_tags(tag_id);

-- Composite index for efficient tag-based order filtering
CREATE INDEX IF NOT EXISTS idx_order_tags_tenant_tag ON public.order_tags(tenant_id, tag_id);

-- 3. Enable RLS
ALTER TABLE public.order_tags ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for order_tags
CREATE POLICY "order_tags_select_tenant" ON public.order_tags
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "order_tags_insert_tenant" ON public.order_tags
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "order_tags_delete_tenant" ON public.order_tags
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Comments for documentation
COMMENT ON TABLE public.order_tags IS 'Junction table for assigning tags to orders for custom categorization';
COMMENT ON COLUMN public.order_tags.order_id IS 'Reference to unified_orders table';
COMMENT ON COLUMN public.order_tags.tag_id IS 'Reference to shared tags table';
