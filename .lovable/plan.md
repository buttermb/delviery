

# Current Issues on the Drivers Page

## Issue: Missing Database Columns and Table

The drivers page query requests columns and a related table that **do not exist** in the `couriers` database table. This causes an HTTP 400 error, meaning **no drivers load at all** — the page shows "No drivers found" even if data exists.

**Columns the query expects but the `couriers` table does NOT have:**
- `display_name`
- `vehicle_year`
- `vehicle_color`
- `zone_id`
- `status`
- `availability`
- `notes`
- `last_seen_at`

**Table the query tries to join that does NOT exist:**
- `delivery_zones` — no such table in the database

**Actual columns in `couriers`:** id, user_id, email, phone, full_name, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, license_number, age_verified, is_active, is_online, current_lat, current_lng, created_at, updated_at, commission_rate, profile_photo_url, rating, total_deliveries, on_time_rate, last_location_update, notification_sound, notification_vibrate, pin_hash, admin_pin, admin_pin_verified, pin_set_at, pin_last_verified_at, tenant_id

## Fix Plan

### Step 1: Database migration — add missing columns + create `delivery_zones` table

Add the missing columns to `couriers`:

```sql
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_color text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspend_reason text;
```

Create `delivery_zones` table + add FK on `couriers`:

```sql
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS: tenant members can read their zones
CREATE POLICY "Tenant members can view zones"
  ON public.delivery_zones FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id);
```

### Step 2: Update `DriverDirectoryPage.tsx` query

Update the select statement to only request columns that exist, and handle the case where `delivery_zones` join returns null gracefully (it already should once the FK exists). Also backfill `is_active` → `status` mapping: drivers with `is_active = true` get `status = 'active'`, others get `'inactive'`.

### Step 3: Backfill existing data

```sql
UPDATE public.couriers SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status = 'pending';
```

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add missing columns to `couriers`, create `delivery_zones`, add FK |
| `src/pages/drivers/DriverDirectoryPage.tsx` | No change needed once DB matches (query is already correct for the intended schema) |

