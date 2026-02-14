-- ============================================================================
-- CREATE DELIVERY ZONES TABLE
-- ============================================================================
-- Supports polygon-based delivery zones with fees, minimums, and hours
-- ============================================================================

-- Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Zone identification
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981', -- Display color for map visualization

  -- Geographic data - polygon coordinates as GeoJSON
  -- Format: [[lng, lat], [lng, lat], ...] representing polygon vertices
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Alternatively support ZIP code list for simpler zone definition
  zip_codes TEXT[] DEFAULT '{}',

  -- Delivery settings
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  minimum_order NUMERIC(10, 2) DEFAULT 0,

  -- Delivery hours per day of week
  -- Format: { "monday": { "open": "09:00", "close": "21:00", "enabled": true }, ... }
  delivery_hours JSONB DEFAULT '{
    "monday": { "open": "09:00", "close": "21:00", "enabled": true },
    "tuesday": { "open": "09:00", "close": "21:00", "enabled": true },
    "wednesday": { "open": "09:00", "close": "21:00", "enabled": true },
    "thursday": { "open": "09:00", "close": "21:00", "enabled": true },
    "friday": { "open": "09:00", "close": "21:00", "enabled": true },
    "saturday": { "open": "10:00", "close": "18:00", "enabled": true },
    "sunday": { "open": "10:00", "close": "18:00", "enabled": false }
  }'::jsonb,

  -- Estimated delivery time range in minutes
  estimated_time_min INTEGER DEFAULT 30,
  estimated_time_max INTEGER DEFAULT 60,

  -- Zone status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority zones take precedence when overlapping

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT delivery_zones_name_tenant_unique UNIQUE (tenant_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_tenant_id ON public.delivery_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_is_active ON public.delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_polygon ON public.delivery_zones USING GIN(polygon);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_zip_codes ON public.delivery_zones USING GIN(zip_codes);

-- Enable RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Tenant users can view their delivery zones" ON public.delivery_zones;
CREATE POLICY "Tenant users can view their delivery zones"
  ON public.delivery_zones
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

DROP POLICY IF EXISTS "Tenant admins can manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Tenant admins can manage delivery zones"
  ON public.delivery_zones
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND tu.role IN ('super_admin', 'admin', 'owner', 'manager')
    )
  );

-- Public read access for storefront zone checking (via store_id lookup)
DROP POLICY IF EXISTS "Public can read active zones for ordering" ON public.delivery_zones;
CREATE POLICY "Public can read active zones for ordering"
  ON public.delivery_zones
  FOR SELECT
  USING (is_active = true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_delivery_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_zones_updated_at();

-- Create helper function to check if a point is within a polygon zone
CREATE OR REPLACE FUNCTION public.point_in_delivery_zone(
  p_tenant_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS TABLE (
  zone_id UUID,
  zone_name TEXT,
  delivery_fee NUMERIC,
  minimum_order NUMERIC,
  delivery_hours JSONB,
  estimated_time_min INTEGER,
  estimated_time_max INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  zone_record RECORD;
  polygon_array JSONB;
  n INTEGER;
  i INTEGER;
  j INTEGER;
  xi NUMERIC;
  yi NUMERIC;
  xj NUMERIC;
  yj NUMERIC;
  inside BOOLEAN;
BEGIN
  -- Check polygon zones first (higher priority)
  FOR zone_record IN
    SELECT dz.*
    FROM public.delivery_zones dz
    WHERE dz.tenant_id = p_tenant_id
    AND dz.is_active = true
    AND jsonb_array_length(dz.polygon) > 2
    ORDER BY dz.priority DESC, dz.created_at ASC
  LOOP
    polygon_array := zone_record.polygon;
    n := jsonb_array_length(polygon_array);
    inside := false;
    j := n - 1;

    -- Ray casting algorithm to check if point is inside polygon
    FOR i IN 0..(n-1) LOOP
      xi := (polygon_array->i->>0)::NUMERIC; -- longitude
      yi := (polygon_array->i->>1)::NUMERIC; -- latitude
      xj := (polygon_array->j->>0)::NUMERIC;
      yj := (polygon_array->j->>1)::NUMERIC;

      IF ((yi > p_lat) != (yj > p_lat)) AND
         (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) THEN
        inside := NOT inside;
      END IF;

      j := i;
    END LOOP;

    IF inside THEN
      zone_id := zone_record.id;
      zone_name := zone_record.name;
      delivery_fee := zone_record.delivery_fee;
      minimum_order := zone_record.minimum_order;
      delivery_hours := zone_record.delivery_hours;
      estimated_time_min := zone_record.estimated_time_min;
      estimated_time_max := zone_record.estimated_time_max;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  -- No polygon match found
  RETURN;
END;
$$;

-- Create helper function to check if a zip code is in a delivery zone
CREATE OR REPLACE FUNCTION public.zip_in_delivery_zone(
  p_tenant_id UUID,
  p_zip_code TEXT
)
RETURNS TABLE (
  zone_id UUID,
  zone_name TEXT,
  delivery_fee NUMERIC,
  minimum_order NUMERIC,
  delivery_hours JSONB,
  estimated_time_min INTEGER,
  estimated_time_max INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dz.id,
    dz.name,
    dz.delivery_fee,
    dz.minimum_order,
    dz.delivery_hours,
    dz.estimated_time_min,
    dz.estimated_time_max
  FROM public.delivery_zones dz
  WHERE dz.tenant_id = p_tenant_id
  AND dz.is_active = true
  AND p_zip_code = ANY(dz.zip_codes)
  ORDER BY dz.priority DESC, dz.created_at ASC
  LIMIT 1;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.delivery_zones TO anon;
GRANT ALL ON public.delivery_zones TO authenticated;
GRANT EXECUTE ON FUNCTION public.point_in_delivery_zone TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zip_in_delivery_zone TO anon, authenticated;

-- Add comment
COMMENT ON TABLE public.delivery_zones IS 'Delivery zones with polygon boundaries, fees, minimums, and delivery hours per tenant';
