# Supabase Development Rules - BigMike Wholesale Platform

## 🔒 CRITICAL SECURITY RULES

### 1. SECURITY DEFINER Functions - MANDATORY

**RULE**: Every `SECURITY DEFINER` function MUST include `SET search_path = public`

```sql
-- ✅ CORRECT
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ← REQUIRED!
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.role = $2
  );
END;
$$;

-- ❌ WRONG (missing SET search_path)
CREATE OR REPLACE FUNCTION public.has_role(user_id uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- ⚠️ Privilege escalation risk!
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.role = $2
  );
END;
$$;
```

### 2. User Roles System - MANDATORY

**RULE**: Store roles in `user_roles` table, NEVER in `profiles` or `auth.users`

```sql
-- ✅ CORRECT
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'tenant_admin', 'customer', 'courier')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- ❌ WRONG
ALTER TABLE profiles ADD COLUMN role text;  -- Never store roles here!
```

### 3. RLS Policies - MANDATORY

**RULE**: Every table MUST have RLS enabled (unless intentionally public)

```sql
-- ✅ CORRECT
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY "Users can only see own tenant orders"
ON orders FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ❌ WRONG (no RLS)
CREATE TABLE sensitive_data (
  id uuid PRIMARY KEY,
  secret text  -- ⚠️ Anyone can read this!
);
```

### 4. Tenant Isolation - MANDATORY

**RULE**: Multi-tenant tables MUST filter by `tenant_id` in RLS policies

```sql
-- ✅ CORRECT
CREATE POLICY "Tenant isolation for products"
ON products FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- ❌ WRONG (no tenant filter)
CREATE POLICY "Anyone can see products"
ON products FOR SELECT
USING (true);  -- ⚠️ Data leakage across tenants!
```

### 5. Foreign Key References

**RULE**: Reference `public.profiles`, NEVER `auth.users` (except in internal functions)

```sql
-- ✅ CORRECT
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.profiles(id),  -- ← Use profiles
  tenant_id uuid REFERENCES public.tenants(id)
);

-- ❌ WRONG
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id),  -- ⚠️ Can't query auth.users from JS
  tenant_id uuid REFERENCES public.tenants(id)
);
```

### 6. Forbidden Schema Modifications

**RULE**: NEVER modify these Supabase-reserved schemas:

```sql
-- ❌ NEVER DO THIS
ALTER TABLE auth.users ADD COLUMN custom_field text;  -- ⚠️ Service outage!
DROP SCHEMA storage CASCADE;  -- ⚠️ Service degradation!
CREATE TRIGGER my_trigger ON realtime.messages;  -- ⚠️ Breaks realtime!

-- ✅ CORRECT - Only modify public schema
ALTER TABLE public.profiles ADD COLUMN custom_field text;
```

**Reserved Schemas:**
- `auth` - Authentication system
- `storage` - File storage
- `realtime` - Real-time subscriptions
- `supabase_functions` - Edge functions metadata
- `vault` - Secrets management

## ⚡ EDGE FUNCTION RULES

### 1. Shared Dependencies - MANDATORY

**RULE**: Import shared dependencies from `supabase/functions/_shared/deps.ts`

```typescript
// ✅ CORRECT
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

// ❌ WRONG
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

### 2. Input Validation - MANDATORY

**RULE**: ALL `req.json()` calls MUST use Zod validation

```typescript
// ✅ CORRECT
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const RequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenant_id: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const body = RequestSchema.parse(rawBody);  // ← REQUIRED!

    const { email, password, tenant_id } = body;
    // ... rest of logic
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
});

// ❌ WRONG (no validation)
serve(async (req) => {
  const body = await req.json();  // ⚠️ Type confusion attack risk!
  const { email, password } = body;  // Unvalidated input
});
```

### 3. CORS Handling - MANDATORY

**RULE**: Handle `OPTIONS` requests and include CORS headers in ALL responses

```typescript
// ✅ CORRECT
import { corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ... your logic
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// ❌ WRONG (missing CORS)
serve(async (req) => {
  return new Response(JSON.stringify({ data }));  // ⚠️ CORS error in browser!
});
```

### 4. Password Hashing - MANDATORY

**RULE**: Use bcrypt with 12 salt rounds, NEVER SHA-256

```typescript
// ✅ CORRECT
import { hash, compare } from '../_shared/deps.ts';

const hashedPassword = await hash(password, 12);  // 12 salt rounds
const isValid = await compare(inputPassword, hashedPassword);

// ❌ WRONG
import { createHash } from 'https://deno.land/std/crypto/mod.ts';
const hashedPassword = createHash('sha256')
  .update(password)
  .digest('hex');  // ⚠️ Not secure for passwords!
```

### 5. JWT Configuration

**RULE**: Set `verify_jwt` in `supabase/config.toml`

```toml
# ✅ CORRECT
# Public/auth endpoints - no JWT required
[functions.customer-auth]
verify_jwt = false

# Protected endpoints - JWT required
[functions.menu-generate]
verify_jwt = true
```

## 📋 CHECKLIST FOR EVERY NEW FEATURE

When adding features, verify:

- [ ] All `SECURITY DEFINER` functions have `SET search_path = public`
- [ ] All edge functions have Zod validation
- [ ] All edge functions handle OPTIONS and return CORS headers
- [ ] All tables have RLS enabled (unless intentionally public)
- [ ] Tenant-scoped tables have tenant_id filtering in RLS
- [ ] No foreign keys to `auth.users` (use profiles table)
- [ ] Password hashing uses bcrypt (not SHA-256)
- [ ] JWT settings in config.toml match function security needs
- [ ] No modifications to auto-generated files
- [ ] Roles stored in separate `user_roles` table
