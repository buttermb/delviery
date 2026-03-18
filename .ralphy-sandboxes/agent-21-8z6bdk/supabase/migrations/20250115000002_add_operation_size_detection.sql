-- Migration: Add operation size detection to tenants table
-- Date: 2025-01-15
-- Description: Adds detected_operation_size column and function to auto-detect operation size based on usage metrics

-- Add detected_operation_size column to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS detected_operation_size TEXT CHECK (detected_operation_size IN ('street', 'small', 'medium', 'enterprise'));

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenants_detected_operation_size ON public.tenants(detected_operation_size);

-- Function to detect operation size based on tenant usage metrics
CREATE OR REPLACE FUNCTION public.detect_operation_size(tenant_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  monthly_orders_count INTEGER;
  team_count INTEGER;
  location_count INTEGER;
  usage_data JSONB;
BEGIN
  -- Get usage metrics from tenants table
  SELECT usage INTO usage_data
  FROM tenants
  WHERE id = tenant_id_param;

  -- Extract metrics from JSONB (with safe defaults)
  monthly_orders_count := COALESCE((usage_data->>'customers')::INTEGER, 0);
  team_count := COALESCE((usage_data->>'users')::INTEGER, 1);
  location_count := COALESCE((usage_data->>'locations')::INTEGER, 1);

  -- Classification logic based on operation size
  -- Street: <50 orders/month, ≤2 team members, 1 location
  IF monthly_orders_count < 50 AND team_count <= 2 AND location_count <= 1 THEN
    RETURN 'street';
  END IF;

  -- Small: <200 orders/month, ≤5 team members, ≤2 locations
  IF monthly_orders_count < 200 AND team_count <= 5 AND location_count <= 2 THEN
    RETURN 'small';
  END IF;

  -- Medium: <1000 orders/month, ≤20 team members, ≤5 locations
  IF monthly_orders_count < 1000 AND team_count <= 20 AND location_count <= 5 THEN
    RETURN 'medium';
  END IF;

  -- Enterprise: 1000+ orders/month, 20+ team members, 5+ locations
  RETURN 'enterprise';
END;
$$;

-- Function to update detected_operation_size for a tenant
CREATE OR REPLACE FUNCTION public.update_detected_operation_size(tenant_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  detected_size TEXT;
BEGIN
  -- Detect operation size
  detected_size := detect_operation_size(tenant_id_param);

  -- Update tenants table
  UPDATE tenants
  SET detected_operation_size = detected_size
  WHERE id = tenant_id_param;

  RETURN detected_size;
END;
$$;

-- Add comment to functions
COMMENT ON FUNCTION public.detect_operation_size IS 'Detects operation size (street/small/medium/enterprise) based on tenant usage metrics';
COMMENT ON FUNCTION public.update_detected_operation_size IS 'Updates the detected_operation_size column for a tenant based on current usage metrics';

-- Add comment to column
COMMENT ON COLUMN public.tenants.detected_operation_size IS 'Auto-detected operation size based on usage metrics (street/small/medium/enterprise)';

