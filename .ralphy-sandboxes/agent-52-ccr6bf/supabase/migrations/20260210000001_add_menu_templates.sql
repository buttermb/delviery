-- ============================================================================
-- MENU TEMPLATES - Save and reuse menu configurations
-- ============================================================================

-- Menu Templates table
CREATE TABLE IF NOT EXISTS public.menu_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Template info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'daily', 'weekend', 'wholesale', 'event', 'custom'

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- config structure:
    -- {
    --   "productIds": [],
    --   "layout": "grid" | "list" | "compact",
    --   "theme": { "primaryColor", "backgroundColor", "accentColor", "fontStyle" },
    --   "availability": { "expirationDays", "maxViews", "burnAfterRead", "timeRestrictions" },
    --   "security": { "requireAccessCode", "screenshotProtection", "watermarkEnabled", "deviceFingerprinting" }
    -- }

    -- Flags
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false, -- Share with all team members

    -- Versioning
    version INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,

    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template version history for rollback support
CREATE TABLE IF NOT EXISTS public.menu_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.menu_templates(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    changelog TEXT,

    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_templates_tenant_id ON public.menu_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_templates_category ON public.menu_templates(category);
CREATE INDEX IF NOT EXISTS idx_menu_templates_is_shared ON public.menu_templates(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_menu_template_versions_template_id ON public.menu_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_menu_template_versions_tenant_id ON public.menu_template_versions(tenant_id);

-- Enable RLS
ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_template_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_templates
DROP POLICY IF EXISTS "Tenants can view their own templates" ON public.menu_templates;
CREATE POLICY "Tenants can view their own templates"
    ON public.menu_templates
    FOR SELECT
    USING (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_templates.tenant_id));

DROP POLICY IF EXISTS "Tenants can insert their own templates" ON public.menu_templates;
CREATE POLICY "Tenants can insert their own templates"
    ON public.menu_templates
    FOR INSERT
    WITH CHECK (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_templates.tenant_id));

DROP POLICY IF EXISTS "Tenants can update their own templates" ON public.menu_templates;
CREATE POLICY "Tenants can update their own templates"
    ON public.menu_templates
    FOR UPDATE
    USING (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_templates.tenant_id));

DROP POLICY IF EXISTS "Tenants can delete their own templates" ON public.menu_templates;
CREATE POLICY "Tenants can delete their own templates"
    ON public.menu_templates
    FOR DELETE
    USING (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_templates.tenant_id));

-- RLS Policies for menu_template_versions
DROP POLICY IF EXISTS "Tenants can view their own template versions" ON public.menu_template_versions;
CREATE POLICY "Tenants can view their own template versions"
    ON public.menu_template_versions
    FOR SELECT
    USING (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_template_versions.tenant_id));

DROP POLICY IF EXISTS "Tenants can insert their own template versions" ON public.menu_template_versions;
CREATE POLICY "Tenants can insert their own template versions"
    ON public.menu_template_versions
    FOR INSERT
    WITH CHECK (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_template_versions.tenant_id));

DROP POLICY IF EXISTS "Tenants can delete their own template versions" ON public.menu_template_versions;
CREATE POLICY "Tenants can delete their own template versions"
    ON public.menu_template_versions
    FOR DELETE
    USING (tenant_id = (SELECT id FROM public.tenants WHERE id = menu_template_versions.tenant_id));

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION public.increment_template_usage(
    template_id UUID,
    p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.menu_templates
    SET
        usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = template_id AND tenant_id = p_tenant_id;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_menu_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_menu_templates_updated_at ON public.menu_templates;
CREATE TRIGGER update_menu_templates_updated_at
    BEFORE UPDATE ON public.menu_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_menu_templates_updated_at();
