/**
 * Storefront Announcements Table
 * Admin-manageable announcement bar for storefront promotions, notices, and launches
 */

-- Storefront announcements table
CREATE TABLE IF NOT EXISTS storefront_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id UUID REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link_url TEXT,
  link_text TEXT,
  background_color TEXT NOT NULL DEFAULT '#3b82f6',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_storefront_announcements_tenant_id
  ON storefront_announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storefront_announcements_store_id
  ON storefront_announcements(store_id);
CREATE INDEX IF NOT EXISTS idx_storefront_announcements_is_active
  ON storefront_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_storefront_announcements_display_order
  ON storefront_announcements(display_order);
CREATE INDEX IF NOT EXISTS idx_storefront_announcements_schedule
  ON storefront_announcements(start_date, end_date)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE storefront_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Tenants can view their own announcements
CREATE POLICY "Tenants can view own announcements" ON storefront_announcements
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Tenants can create announcements for their tenant
CREATE POLICY "Tenants can create announcements" ON storefront_announcements
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Tenants can update their own announcements
CREATE POLICY "Tenants can update own announcements" ON storefront_announcements
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Tenants can delete their own announcements
CREATE POLICY "Tenants can delete own announcements" ON storefront_announcements
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  );

-- Public can view active announcements for storefront display
CREATE POLICY "Public can view active announcements" ON storefront_announcements
  FOR SELECT
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_storefront_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storefront_announcements_updated_at
  BEFORE UPDATE ON storefront_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_announcements_updated_at();
