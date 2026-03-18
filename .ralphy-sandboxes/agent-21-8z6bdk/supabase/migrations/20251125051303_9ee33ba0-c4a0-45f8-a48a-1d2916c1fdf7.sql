-- Phase 2: Add missing database columns and functions

-- Add missing columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00;

-- Add missing columns to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS business_tier TEXT DEFAULT 'street',
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tier_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tier_detected_at TIMESTAMPTZ;

-- Add missing column to tenant_users table  
ALTER TABLE tenant_users
ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Create track_feature_usage function
CREATE OR REPLACE FUNCTION track_feature_usage(
  p_user_id UUID,
  p_tenant_id UUID,
  p_feature_id TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO feature_usage_tracking (user_id, tenant_id, feature_id, usage_count, last_used_at)
  VALUES (p_user_id, p_tenant_id, p_feature_id, 1, NOW())
  ON CONFLICT (user_id, tenant_id, feature_id) 
  DO UPDATE SET 
    usage_count = feature_usage_tracking.usage_count + 1,
    last_used_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create update_tenant_tier function
CREATE OR REPLACE FUNCTION update_tenant_tier(
  p_tenant_id UUID,
  p_tier TEXT,
  p_override BOOLEAN DEFAULT true
) RETURNS void AS $$
BEGIN
  UPDATE tenants 
  SET 
    business_tier = p_tier,
    tier_override = p_override,
    tier_detected_at = NOW(),
    updated_at = NOW()
  WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;