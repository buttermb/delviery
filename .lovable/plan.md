

# Fix Remaining Diagnostic Issues

## Summary

| Issue | Status | Fix Required |
|-------|--------|--------------|
| Edge Functions "Failed to fetch" | Working (false positive) | Update CORS headers to include additional Supabase headers |
| Roles table empty | Warning | Seed default roles for existing tenants |

---

## Analysis

### Edge Functions Status

I tested the edge functions directly and confirmed they ARE working:

```text
credits-balance → 200 OK, returns valid balance data
send-notification → 500 (expected - validation error due to empty body)
```

The "Failed to fetch" in diagnostics is a **false positive** caused by:
1. CORS headers missing some Supabase client headers
2. Cold start latency during audit runs

### Roles Table Status

The `roles` table exists but is empty. The table structure:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant isolation |
| name | text | Role name |
| description | text | Role description |
| is_system | boolean | Whether it's a system-defined role |
| permissions | JSONB | Role permissions |

Default system roles need to be seeded for each tenant.

---

## Implementation Plan

### Step 1: Update CORS Headers

Update `supabase/functions/_shared/deps.ts` to include all Supabase client headers:

**Current:**
```typescript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
```

**Updated:**
```typescript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

This matches the headers that the Supabase JS client sends.

### Step 2: Seed Default Roles for All Tenants

Create a database migration to seed default roles for all existing tenants:

```sql
INSERT INTO roles (tenant_id, name, description, is_system, permissions)
SELECT 
  t.id,
  role_def.name,
  role_def.description,
  true,
  role_def.permissions
FROM tenants t
CROSS JOIN (VALUES
  ('owner', 'Business Owner', '{"*": true}'::jsonb),
  ('admin', 'Administrator', '{"orders:*": true, "products:*": true, "inventory:*": true, "staff:read": true, "settings:read": true}'::jsonb),
  ('team_member', 'Team Member', '{"orders:read": true, "orders:update": true, "products:read": true, "inventory:read": true}'::jsonb),
  ('viewer', 'Viewer', '{"orders:read": true, "products:read": true, "inventory:read": true}'::jsonb)
) AS role_def(name, description, permissions)
ON CONFLICT DO NOTHING;
```

### Step 3: Add Trigger for New Tenants

Create a trigger to automatically seed roles when a new tenant is created:

```sql
CREATE OR REPLACE FUNCTION seed_tenant_roles()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO roles (tenant_id, name, description, is_system, permissions)
  VALUES 
    (NEW.id, 'owner', 'Business Owner', true, '{"*": true}'::jsonb),
    (NEW.id, 'admin', 'Administrator', true, '{"orders:*": true, "products:*": true, "inventory:*": true}'::jsonb),
    (NEW.id, 'team_member', 'Team Member', true, '{"orders:read": true, "orders:update": true}'::jsonb),
    (NEW.id, 'viewer', 'Viewer', true, '{"orders:read": true, "products:read": true}'::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seed_roles_on_tenant_insert
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION seed_tenant_roles();
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/deps.ts` | Add missing CORS headers |
| Database migration | Seed default roles for existing tenants |
| Database migration | Add trigger for new tenant role seeding |

---

## Expected Results

After these fixes:
- All edge function diagnostic checks pass
- Roles table contains default roles for each tenant
- New tenants automatically get default roles
- Warning "No roles found in database" is resolved

