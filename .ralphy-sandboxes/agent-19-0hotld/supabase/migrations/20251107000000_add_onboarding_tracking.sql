-- Migration: Add onboarding tracking columns to tenants table and feature_usage table
-- Date: 2025-11-07

-- Add onboarding tracking columns to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS demo_data_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tooltips_dismissed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tooltips_dismissed_at TIMESTAMPTZ;

-- Create feature_usage table for tracking feature adoption
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  first_used_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_usage_tenant ON feature_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage(feature_name);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_usage_unique ON feature_usage(tenant_id, feature_name);

-- Add RLS policies
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own feature usage
CREATE POLICY "Tenants can view own feature usage"
ON feature_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = feature_usage.tenant_id
    AND tenants.id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Tenants can insert their own feature usage
CREATE POLICY "Tenants can insert own feature usage"
ON feature_usage
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = feature_usage.tenant_id
    AND tenants.id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Tenants can update their own feature usage
CREATE POLICY "Tenants can update own feature usage"
ON feature_usage
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = feature_usage.tenant_id
    AND tenants.id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feature_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER feature_usage_updated_at
BEFORE UPDATE ON feature_usage
FOR EACH ROW
EXECUTE FUNCTION update_feature_usage_updated_at();

