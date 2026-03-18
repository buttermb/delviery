-- ============================================================================
-- ADAPTIVE SIDEBAR: Create feature_usage_tracking table and increment function
-- ============================================================================

-- Create feature_usage_tracking table for analytics
CREATE TABLE IF NOT EXISTS public.feature_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feature_id TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, feature_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_usage_tenant_user 
ON public.feature_usage_tracking(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_id 
ON public.feature_usage_tracking(feature_id);

CREATE INDEX IF NOT EXISTS idx_feature_usage_last_used 
ON public.feature_usage_tracking(last_used_at DESC);

-- Enable RLS
ALTER TABLE public.feature_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own feature usage"
ON public.feature_usage_tracking
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

CREATE POLICY "System can insert feature usage"
ON public.feature_usage_tracking
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update feature usage"
ON public.feature_usage_tracking
FOR UPDATE
USING (true);

CREATE POLICY "Super admins can view all feature usage"
ON public.feature_usage_tracking
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Create atomic increment function
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_tenant_id UUID,
  p_user_id UUID,
  p_feature_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feature_usage_tracking (
    tenant_id,
    user_id,
    feature_id,
    usage_count,
    last_used_at
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_feature_id,
    1,
    NOW()
  )
  ON CONFLICT (tenant_id, user_id, feature_id)
  DO UPDATE SET
    usage_count = feature_usage_tracking.usage_count + 1,
    last_used_at = NOW();
END;
$$;

-- Add comment
COMMENT ON TABLE public.feature_usage_tracking IS 'Tracks feature usage for analytics and hot items generation in adaptive sidebar';
COMMENT ON FUNCTION public.increment_feature_usage IS 'Atomically increments feature usage count for a user';