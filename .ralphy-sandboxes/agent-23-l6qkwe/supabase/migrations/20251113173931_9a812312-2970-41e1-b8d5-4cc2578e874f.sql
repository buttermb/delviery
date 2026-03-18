-- ============================================================================
-- ADAPTIVE SIDEBAR: Add operation size detection to tenants table
-- ============================================================================

-- Add columns for operation size detection
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS detected_operation_size TEXT CHECK (detected_operation_size IN ('street', 'small', 'medium', 'enterprise')),
ADD COLUMN IF NOT EXISTS monthly_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1;

-- Create index for operation size queries
CREATE INDEX IF NOT EXISTS idx_tenants_operation_size 
ON public.tenants(detected_operation_size);

-- Create function to auto-detect operation size
CREATE OR REPLACE FUNCTION public.detect_operation_size(
  p_tenant_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_orders INTEGER;
  v_team_size INTEGER;
  v_location_count INTEGER;
BEGIN
  -- Get tenant metrics
  SELECT 
    COALESCE(monthly_orders, 0),
    COALESCE(team_size, 1),
    COALESCE((usage->>'locations')::INTEGER, 1)
  INTO v_monthly_orders, v_team_size, v_location_count
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Classify based on metrics
  IF v_monthly_orders < 50 AND v_team_size <= 2 AND v_location_count <= 1 THEN
    RETURN 'street';
  ELSIF v_monthly_orders < 200 AND v_team_size <= 5 AND v_location_count <= 2 THEN
    RETURN 'small';
  ELSIF v_monthly_orders < 1000 AND v_team_size <= 20 AND v_location_count <= 5 THEN
    RETURN 'medium';
  ELSE
    RETURN 'enterprise';
  END IF;
END;
$$;

-- Update existing tenants with detected operation size
UPDATE public.tenants
SET detected_operation_size = detect_operation_size(id)
WHERE detected_operation_size IS NULL;

-- Add comments
COMMENT ON COLUMN public.tenants.detected_operation_size IS 'Auto-detected operation size for adaptive sidebar (street, small, medium, enterprise)';
COMMENT ON COLUMN public.tenants.monthly_orders IS 'Approximate monthly order count for operation size detection';
COMMENT ON COLUMN public.tenants.team_size IS 'Number of team members for operation size detection';
COMMENT ON FUNCTION public.detect_operation_size IS 'Auto-detects operation size based on tenant metrics';