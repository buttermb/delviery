-- Add missing columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS white_label jsonb DEFAULT '{"enabled": false}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  flag_name text NOT NULL,
  enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  features jsonb DEFAULT '{}'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to feature_flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Allow read access to subscription_plans" ON subscription_plans FOR SELECT USING (true);