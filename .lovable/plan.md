

# Fix Build Errors and Diagnostic Failures

## Summary

There are 3 categories of issues to fix:

| Category | Issue | Impact |
|----------|-------|--------|
| Build Error | Missing `return` in ModernHero.tsx | Blocks deployment |
| Database | Missing `roles` and `tenant_role_permissions` tables | Diagnostics failing |
| Config | Mismatched project_id in config.toml | Edge functions may not deploy correctly |

---

## Issue 1: Build Error - Missing Return Statement

**File:** `src/components/marketing/ModernHero.tsx`

**Problem:** Line 56 starts JSX without a `return` statement, causing error TS1128 at line 189.

**Current Code (lines 53-56):**
```typescript
const currentFeature = CYCLE_FEATURES[featureIndex];
const FeatureIcon = currentFeature.icon;

<section className="relative min-h-[90vh]...
```

**Fix:** Add `return (` before line 56 and ensure proper closing `)` at the end.

---

## Issue 2: Missing Database Tables

**Problem:** The `roles` and `tenant_role_permissions` tables don't exist even though migration `20260128000001_tenant_roles.sql` defines them.

**Tables to Create:**

1. **`roles`** - Tenant-specific custom role definitions
   - `id` (UUID, PK)
   - `tenant_id` (UUID, FK to tenants)
   - `name` (text)
   - `description` (text)
   - `is_system` (boolean)
   - `permissions` (jsonb)

2. **`tenant_role_permissions`** - Role-permission mappings
   - `id` (UUID, PK)
   - `role_id` (UUID, FK to roles)
   - `permission` (text)
   - `tenant_id` (UUID, FK to tenants)

**Fix:** Run the existing migration SQL to create these tables with proper RLS policies.

---

## Issue 3: Config Mismatch

**Problem:** `supabase/config.toml` has `project_id = "mtvwmyerntkhrcdnhahp"` but the actual Supabase project is `aejugtmhwwknrowfyzie`.

**Fix:** Update project_id to match the actual project.

---

## Issue 4: Edge Function "Failed to Fetch" Errors

**Analysis:** The following edge functions are failing:
- `send-notification`
- `create-order`
- `update-order-status`
- `invoice-management`
- `credits-balance`

These functions exist in the codebase and have proper CORS headers. The "Failed to fetch" errors indicate they may not be deployed or there's a network/CORS issue.

**Root Cause:** The project_id mismatch in config.toml is likely preventing proper deployment.

**Fix:** After correcting the project_id, the functions should deploy correctly with the next build.

---

## Implementation Plan

### Step 1: Fix Build Error
Update `ModernHero.tsx` to add the missing `return (` before the JSX:

```typescript
const currentFeature = CYCLE_FEATURES[featureIndex];
const FeatureIcon = currentFeature.icon;

return (
  <section className="relative min-h-[90vh]...
```

### Step 2: Fix Config.toml
Update the project_id from `mtvwmyerntkhrcdnhahp` to `aejugtmhwwknrowfyzie`.

### Step 3: Apply Database Migration
Create the `roles` and `tenant_role_permissions` tables with:
- Proper tenant isolation via RLS
- Foreign key to tenants table
- System role seeding (admin, owner, team_member, viewer)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/marketing/ModernHero.tsx` | Add `return (` before JSX |
| `supabase/config.toml` | Update project_id to correct value |
| Database Migration | Create `roles` and `tenant_role_permissions` tables |

---

## Expected Results

After these fixes:
- Build completes successfully
- All 6 failing diagnostic checks pass
- Edge functions become reachable
- Roles & Permissions system fully operational

