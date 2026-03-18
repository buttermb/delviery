-- ============================================================================
-- PRODUCT TAGS SYSTEM
-- Junction table for assigning tags to products for custom categorization
-- Reuses the existing tags table for tag definitions (from customer_tags_system)
-- ============================================================================

-- 1. Product Tag Assignments junction table - many-to-many between products and tags
CREATE TABLE IF NOT EXISTS public.product_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT product_tag_assignments_unique UNIQUE (product_id, tag_id)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_tenant_id ON public.product_tag_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_product_id ON public.product_tag_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_tag_id ON public.product_tag_assignments(tag_id);

-- Composite index for efficient tag-based product filtering
CREATE INDEX IF NOT EXISTS idx_product_tag_assignments_tenant_tag ON public.product_tag_assignments(tenant_id, tag_id);

-- 3. Enable RLS
ALTER TABLE public.product_tag_assignments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for product_tag_assignments
CREATE POLICY "product_tag_assignments_select_tenant" ON public.product_tag_assignments
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "product_tag_assignments_insert_tenant" ON public.product_tag_assignments
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "product_tag_assignments_update_tenant" ON public.product_tag_assignments
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "product_tag_assignments_delete_tenant" ON public.product_tag_assignments
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Comments for documentation
COMMENT ON TABLE public.product_tag_assignments IS 'Junction table for assigning tags to products for custom categorization';
COMMENT ON COLUMN public.product_tag_assignments.product_id IS 'Reference to products table';
COMMENT ON COLUMN public.product_tag_assignments.tag_id IS 'Reference to shared tags table';
