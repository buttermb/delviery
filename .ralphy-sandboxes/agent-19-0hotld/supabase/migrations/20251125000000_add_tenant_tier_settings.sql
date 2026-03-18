-- Add columns to tenant_settings if not exists
ALTER TABLE tenant_settings 
ADD COLUMN IF NOT EXISTS enabled_features TEXT[],
ADD COLUMN IF NOT EXISTS hidden_features TEXT[],
ADD COLUMN IF NOT EXISTS dashboard_widgets TEXT[],
ADD COLUMN IF NOT EXISTS automation_rules TEXT[],
ADD COLUMN IF NOT EXISTS feature_limits JSONB;

-- Create index for tier queries
CREATE INDEX IF NOT EXISTS idx_tenants_business_tier 
ON tenants(business_tier);
