-- Add operation size detection fields to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS detected_operation_size TEXT CHECK (detected_operation_size IN ('street', 'small', 'medium', 'enterprise')),
ADD COLUMN IF NOT EXISTS monthly_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_size_detection_at TIMESTAMPTZ;

-- Create operation size detection function
CREATE OR REPLACE FUNCTION public.detect_operation_size(p_tenant_id UUID)
RETURNS TEXT
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

-- Create trigger to auto-update detected_operation_size when metrics change
CREATE OR REPLACE FUNCTION public.auto_detect_operation_size()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.detected_operation_size := detect_operation_size(NEW.id);
  NEW.last_size_detection_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_detect_operation_size
  BEFORE INSERT OR UPDATE OF monthly_orders, team_size, usage
  ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_operation_size();

-- Initialize detected_operation_size for existing tenants
UPDATE public.tenants
SET detected_operation_size = detect_operation_size(id),
    last_size_detection_at = NOW()
WHERE detected_operation_size IS NULL;