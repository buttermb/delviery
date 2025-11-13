-- Migration: Extend feature_usage table for sidebar analytics
-- Date: 2025-01-15
-- Description: Adds sidebar-specific tracking to existing feature_usage table and creates increment function

-- Create feature_usage_tracking table for per-user feature usage (if not exists)
CREATE TABLE IF NOT EXISTS public.feature_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  access_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT feature_usage_tracking_unique UNIQUE (tenant_id, user_id, feature_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_usage_tracking_tenant ON public.feature_usage_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_tracking_user ON public.feature_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_tracking_feature ON public.feature_usage_tracking(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_tracking_last_accessed ON public.feature_usage_tracking(last_accessed_at DESC);

-- Enable RLS
ALTER TABLE public.feature_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own feature usage
CREATE POLICY "Users can view own feature usage tracking"
ON public.feature_usage_tracking
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- RLS Policy: Users can insert their own feature usage
CREATE POLICY "Users can insert own feature usage tracking"
ON public.feature_usage_tracking
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- RLS Policy: Users can update their own feature usage
CREATE POLICY "Users can update own feature usage tracking"
ON public.feature_usage_tracking
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

-- Function to increment feature usage (atomic upsert)
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_tenant_id UUID,
  p_user_id UUID,
  p_feature_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feature_usage_tracking (tenant_id, user_id, feature_id, access_count, last_accessed_at)
  VALUES (p_tenant_id, p_user_id, p_feature_id, 1, NOW())
  ON CONFLICT (tenant_id, user_id, feature_id)
  DO UPDATE SET
    access_count = feature_usage_tracking.access_count + 1,
    last_accessed_at = NOW();
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.increment_feature_usage IS 'Atomically increments feature usage count for a user, creating record if it does not exist';

