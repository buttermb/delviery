-- =============================================================
-- Migration: Driver Management System
-- Creates delivery_zones, couriers (with driver mgmt columns),
-- driver_activity_log. Adds RLS and indexes.
-- =============================================================

-- =============================================================
-- 1. Create delivery_zones table (prerequisite for couriers.zone_id)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  zip_codes TEXT[] DEFAULT '{}',
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  minimum_order NUMERIC(10, 2) DEFAULT 0,
  delivery_hours JSONB DEFAULT '{
    "monday":    { "open": "09:00", "close": "21:00", "enabled": true },
    "tuesday":   { "open": "09:00", "close": "21:00", "enabled": true },
    "wednesday": { "open": "09:00", "close": "21:00", "enabled": true },
    "thursday":  { "open": "09:00", "close": "21:00", "enabled": true },
    "friday":    { "open": "09:00", "close": "21:00", "enabled": true },
    "saturday":  { "open": "10:00", "close": "18:00", "enabled": true },
    "sunday":    { "open": "10:00", "close": "18:00", "enabled": false }
  }'::jsonb,
  estimated_time_min INTEGER DEFAULT 30,
  estimated_time_max INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT delivery_zones_name_tenant_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_tenant_id ON public.delivery_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_is_active ON public.delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_polygon ON public.delivery_zones USING GIN(polygon);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_zip_codes ON public.delivery_zones USING GIN(zip_codes);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view their delivery zones" ON public.delivery_zones;
CREATE POLICY "Tenant users can view their delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Tenant admins can manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Tenant admins can manage delivery zones"
  ON public.delivery_zones FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
        AND tu.role IN ('super_admin', 'admin', 'owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "Public can read active zones for ordering" ON public.delivery_zones;
CREATE POLICY "Public can read active zones for ordering"
  ON public.delivery_zones FOR SELECT
  USING (is_active = true);

-- updated_at trigger for delivery_zones
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
  FOR EACH ROW EXECUTE FUNCTION update_delivery_zones_updated_at();

GRANT SELECT ON public.delivery_zones TO anon;
GRANT ALL ON public.delivery_zones TO authenticated;

COMMENT ON TABLE public.delivery_zones IS
  'Delivery zones with polygon boundaries, fees, minimums, and delivery hours per tenant';

-- =============================================================
-- 2. Create couriers table with all driver management columns
-- =============================================================

CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  full_name TEXT NOT NULL,
  display_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,

  -- Vehicle
  vehicle_type TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  vehicle_plate TEXT,

  -- Compliance
  license_number TEXT NOT NULL,
  age_verified BOOLEAN DEFAULT false,
  background_check_status TEXT DEFAULT 'pending',
  background_check_date TIMESTAMPTZ,
  license_front_url TEXT,
  license_back_url TEXT,
  vehicle_insurance_url TEXT,
  vehicle_registration_url TEXT,
  insurance_expiry DATE,

  -- Driver management
  status TEXT NOT NULL DEFAULT 'pending',
  availability TEXT NOT NULL DEFAULT 'offline',
  zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  commission_rate NUMERIC(5,2) DEFAULT 30.00,
  weekly_earnings_goal NUMERIC(10,2),
  notes TEXT,

  -- Legacy booleans (kept for backward compatibility)
  is_active BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  available_for_orders BOOLEAN DEFAULT true,

  -- Location
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT couriers_status_check
    CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'terminated')),
  CONSTRAINT couriers_availability_check
    CHECK (availability IN ('online', 'offline', 'on_delivery')),
  CONSTRAINT couriers_vehicle_type_check
    CHECK (vehicle_type IN ('car', 'van', 'motorcycle', 'bicycle', 'truck'))
);

-- Add missing columns if the table already existed
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS vehicle_year INTEGER;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS vehicle_color TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS vehicle_registration_url TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS vehicle_insurance_url TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'pending';
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS background_check_date TIMESTAMPTZ;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS license_front_url TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS license_back_url TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'offline';
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS weekly_earnings_goal NUMERIC(10,2);
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS available_for_orders BOOLEAN DEFAULT true;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_couriers_tenant_id ON public.couriers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_couriers_tenant_status ON public.couriers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_couriers_tenant_availability ON public.couriers(tenant_id, availability);
CREATE INDEX IF NOT EXISTS idx_couriers_zone ON public.couriers(zone_id);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Couriers can view their own data
DROP POLICY IF EXISTS "Couriers can view their own data" ON public.couriers;
CREATE POLICY "Couriers can view their own data"
  ON public.couriers FOR SELECT
  USING (auth.uid() = user_id);

-- Couriers can update their own location and status
DROP POLICY IF EXISTS "Couriers can update their own data" ON public.couriers;
CREATE POLICY "Couriers can update their own data"
  ON public.couriers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tenant admins can fully manage couriers
DROP POLICY IF EXISTS "Tenant admins can manage couriers" ON public.couriers;
CREATE POLICY "Tenant admins can manage couriers"
  ON public.couriers FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
        AND tu.role IN ('super_admin', 'admin', 'owner', 'manager')
    )
  );

-- updated_at trigger for couriers
CREATE OR REPLACE FUNCTION update_couriers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS couriers_updated_at ON public.couriers;
CREATE TRIGGER couriers_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION update_couriers_updated_at();

GRANT ALL ON public.couriers TO authenticated;

COMMENT ON TABLE public.couriers IS
  'Driver/courier profiles with vehicle info, compliance, status, and zone assignments';

-- =============================================================
-- 3. Create driver_activity_log table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.driver_activity_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id  UUID        NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,
  event_data JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_activity_log_tenant ON public.driver_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_driver ON public.driver_activity_log(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_activity_log_created ON public.driver_activity_log(created_at DESC);

ALTER TABLE public.driver_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view driver activity" ON public.driver_activity_log;
CREATE POLICY "Tenant users can view driver activity"
  ON public.driver_activity_log FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Tenant admins can manage driver activity" ON public.driver_activity_log;
CREATE POLICY "Tenant admins can manage driver activity"
  ON public.driver_activity_log FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.status = 'active'
        AND tu.role IN ('super_admin', 'admin', 'owner', 'manager')
    )
  );

GRANT ALL ON public.driver_activity_log TO authenticated;

COMMENT ON TABLE public.driver_activity_log IS
  'Audit trail for driver lifecycle events (status changes, zone assignments, notes, etc.)';

-- =============================================================
-- 4. Helper functions
-- =============================================================

-- Check if a point falls within a delivery zone (ray casting)
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  zone_record RECORD;
  polygon_array JSONB;
  n INTEGER;
  i INTEGER;
  j INTEGER;
  xi NUMERIC; yi NUMERIC;
  xj NUMERIC; yj NUMERIC;
  inside BOOLEAN;
BEGIN
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

    FOR i IN 0..(n-1) LOOP
      xi := (polygon_array->i->>0)::NUMERIC;
      yi := (polygon_array->i->>1)::NUMERIC;
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
  RETURN;
END;
$$;

-- Check if a zip code is in a delivery zone
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT dz.id, dz.name, dz.delivery_fee, dz.minimum_order,
         dz.delivery_hours, dz.estimated_time_min, dz.estimated_time_max
  FROM public.delivery_zones dz
  WHERE dz.tenant_id = p_tenant_id
    AND dz.is_active = true
    AND p_zip_code = ANY(dz.zip_codes)
  ORDER BY dz.priority DESC, dz.created_at ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.point_in_delivery_zone TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zip_in_delivery_zone TO anon, authenticated;
