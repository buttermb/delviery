-- Add missing columns to wholesale_deliveries
ALTER TABLE wholesale_deliveries 
ADD COLUMN IF NOT EXISTS scheduled_pickup_time TIMESTAMPTZ;

-- Create menu_access table if not exists
CREATE TABLE IF NOT EXISTS menu_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  customer_id UUID,
  menu_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create menus table if not exists  
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create menu_products table if not exists
CREATE TABLE IF NOT EXISTS menu_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  product_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create usage_events table if not exists
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  event_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);