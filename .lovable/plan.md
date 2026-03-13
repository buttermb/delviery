

# Fix Signup Edge Function: Remove Non-Existent `p_plan` Parameter

## Root Cause

The edge function logs show the exact error:

```
Could not find the function public.create_tenant_atomic(
  p_auth_user_id, p_business_name, p_company_size, p_email, 
  p_industry, p_owner_name, p_phone, p_plan, p_slug, p_state
) in the schema cache
```

The `create_tenant_atomic` database function does **not** have a `p_plan` parameter — the function hardcodes the plan as `'starter'` internally. The edge function on line 271 passes `p_plan: 'free'`, causing a signature mismatch and a 500 error.

## Fix

**File**: `supabase/functions/tenant-signup/index.ts` (line 271)

Remove this line from the RPC call:
```typescript
p_plan: 'free', // ← DELETE THIS LINE
```

One line removed. The database function already defaults new tenants to the `'starter'` plan with a 14-day trial — no plan parameter is needed.

