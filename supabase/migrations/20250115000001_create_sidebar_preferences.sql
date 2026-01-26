-- Migration: Create sidebar_preferences table for adaptive sidebar system
-- Date: 2025-01-15
-- Description: Stores user preferences for sidebar layout, operation size, favorites, and collapsed sections

-- Create sidebar_preferences table
CREATE TABLE IF NOT EXISTS public.sidebar_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_size TEXT CHECK (operation_size IN ('street', 'small', 'medium', 'enterprise')),
  custom_layout JSONB DEFAULT '{}'::jsonb,
  favorites JSONB DEFAULT '[]'::jsonb,
  collapsed_sections JSONB DEFAULT '[]'::jsonb,
  pinned_items JSONB DEFAULT '[]'::jsonb,
  last_accessed_features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sidebar_preferences_tenant_user_unique UNIQUE (tenant_id, user_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_tenant ON public.sidebar_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_user ON public.sidebar_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_operation_size ON public.sidebar_preferences(operation_size);

-- Enable RLS
ALTER TABLE public.sidebar_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own preferences
CREATE POLICY "Users can view own sidebar preferences"
ON public.sidebar_preferences
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- RLS Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own sidebar preferences"
ON public.sidebar_preferences
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- RLS Policy: Users can update their own preferences
CREATE POLICY "Users can update own sidebar preferences"
ON public.sidebar_preferences
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- RLS Policy: Users can delete their own preferences
CREATE POLICY "Users can delete own sidebar preferences"
ON public.sidebar_preferences
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sidebar_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER sidebar_preferences_updated_at
BEFORE UPDATE ON public.sidebar_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_sidebar_preferences_updated_at();

-- Add comment to table
COMMENT ON TABLE public.sidebar_preferences IS 'Stores user preferences for adaptive sidebar layout, operation size, favorites, and collapsed sections';

