-- ============================================================================
-- CUSTOMER TAGS SYSTEM
-- Normalized tag management with tags table and customer_tags junction table
-- ============================================================================

-- 1. Tags table - stores tag definitions per tenant
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT tags_tenant_name_unique UNIQUE (tenant_id, name)
);

-- 2. Customer Tags junction table - many-to-many between contacts and tags
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT customer_tags_unique UNIQUE (contact_id, tag_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON public.tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tenant_id ON public.customer_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_contact_id ON public.customer_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_id ON public.customer_tags(tag_id);

-- 4. Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for tags
CREATE POLICY "tags_select_tenant" ON public.tags
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tags_insert_tenant" ON public.tags
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tags_update_tenant" ON public.tags
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tags_delete_tenant" ON public.tags
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 6. RLS Policies for customer_tags
CREATE POLICY "customer_tags_select_tenant" ON public.customer_tags
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "customer_tags_insert_tenant" ON public.customer_tags
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "customer_tags_delete_tenant" ON public.customer_tags
  FOR DELETE USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 7. Updated_at trigger for tags table
CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tags_updated_at ON public.tags;
CREATE TRIGGER trigger_update_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tags_updated_at();
