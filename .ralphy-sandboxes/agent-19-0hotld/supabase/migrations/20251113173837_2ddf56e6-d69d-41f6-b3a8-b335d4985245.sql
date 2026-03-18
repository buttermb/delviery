-- ============================================================================
-- ADAPTIVE SIDEBAR: Create sidebar_preferences table
-- ============================================================================

-- Create sidebar_preferences table for user-specific sidebar configuration
CREATE TABLE IF NOT EXISTS public.sidebar_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  operation_size TEXT CHECK (operation_size IN ('street', 'small', 'medium', 'enterprise')),
  custom_layout BOOLEAN DEFAULT false,
  favorites TEXT[] DEFAULT '{}',
  collapsed_sections TEXT[] DEFAULT '{}',
  pinned_items TEXT[] DEFAULT '{}',
  last_accessed_features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_tenant_user 
ON public.sidebar_preferences(tenant_id, user_id);

-- Enable RLS
ALTER TABLE public.sidebar_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own preferences within their tenant
CREATE POLICY "Users can view own sidebar preferences"
ON public.sidebar_preferences
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

CREATE POLICY "Users can insert own sidebar preferences"
ON public.sidebar_preferences
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update own sidebar preferences"
ON public.sidebar_preferences
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

CREATE POLICY "Super admins can view all sidebar preferences"
ON public.sidebar_preferences
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_sidebar_preferences_updated_at
  BEFORE UPDATE ON public.sidebar_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add comment
COMMENT ON TABLE public.sidebar_preferences IS 'User-specific sidebar configuration and preferences for adaptive sidebar system';