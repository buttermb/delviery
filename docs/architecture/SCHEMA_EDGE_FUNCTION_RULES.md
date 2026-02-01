# Database Schema & Edge Function Rules

## 📊 PART 1: DATABASE SCHEMA RULES

### 1.1 TABLE CREATION RULES

#### ✅ ALWAYS DO:

```sql
-- ✓ Use proper naming: lowercase_with_underscores
CREATE TABLE public.wholesale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ✓ Add indexes on foreign keys and frequently queried columns
CREATE INDEX idx_wholesale_orders_tenant_id ON public.wholesale_orders(tenant_id);
CREATE INDEX idx_wholesale_orders_status ON public.wholesale_orders(status);
CREATE INDEX idx_wholesale_orders_created_at ON public.wholesale_orders(created_at);

-- ✓ Enable RLS immediately
ALTER TABLE public.wholesale_orders ENABLE ROW LEVEL SECURITY;
```

#### ❌ NEVER DO:

```sql
-- ✗ Don't use camelCase or PascalCase
CREATE TABLE WholesaleOrders ( ... )
CREATE TABLE wholesaleOrders ( ... )

-- ✗ Don't reference auth.users directly
CREATE TABLE orders (
  user_id UUID REFERENCES auth.users(id)  -- ❌ WRONG
);

-- ✗ Don't forget tenant_id for multi-tenant tables
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name TEXT
  -- ❌ Missing tenant_id!
);
```

### 1.2 MULTI-TENANT SCHEMA RULES

#### ✅ REQUIRED PATTERN:

```sql
-- Step 1: Add tenant_id column
ALTER TABLE table_name ADD COLUMN tenant_id UUID;

-- Step 2: Add foreign key constraint
ALTER TABLE table_name 
  ADD CONSTRAINT fk_table_tenant 
  FOREIGN KEY (tenant_id) 
  REFERENCES public.tenants(id) 
  ON DELETE CASCADE;

-- Step 3: Create index
CREATE INDEX idx_table_tenant_id ON table_name(tenant_id);

-- Step 4: Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Step 5: Create tenant isolation policy
CREATE POLICY "Tenant isolation for table_name"
  ON table_name FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

#### ❌ NEVER:

```sql
-- ✗ Don't create tables without tenant_id if they store tenant-specific data
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name TEXT
  -- ❌ No tenant_id means data leak risk!
);

-- ✗ Don't use weak RLS policies
CREATE POLICY "Allow all" ON table_name FOR ALL USING (true);  -- ❌ NO!
```

### 1.3 FOREIGN KEY RULES

#### ✅ CORRECT:

```sql
-- ✓ Reference public schema tables
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- ✓ Use proper cascade actions
ON DELETE CASCADE    -- When parent deleted, delete child
ON DELETE SET NULL   -- When parent deleted, set to NULL
ON DELETE RESTRICT   -- Prevent deletion if children exist
```

#### ❌ WRONG:

```sql
-- ✗ NEVER reference auth.users directly
CREATE TABLE orders (
  user_id UUID REFERENCES auth.users(id)  -- ❌ FORBIDDEN
);

-- ✗ Don't forget ON DELETE actions
CREATE TABLE order_items (
  order_id UUID REFERENCES orders(id)  -- ❌ Missing ON DELETE
);
```

### 1.4 RLS POLICY PATTERNS

#### ✅ STANDARD PATTERNS:

**Pattern 1: Tenant Isolation**

```sql
CREATE POLICY "Tenant users can view their tenant data"
  ON table_name FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

**Pattern 2: Admin Access**

```sql
CREATE POLICY "Admins can manage all data"
  ON table_name FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

**Pattern 3: User Owns Record**

```sql
CREATE POLICY "Users can view own records"
  ON table_name FOR SELECT
  USING (user_id = auth.uid());
```

**Pattern 4: Public Read, Tenant Write**

```sql
CREATE POLICY "Public can view"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Tenant can manage"
  ON products FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

#### ❌ NEVER USE:

```sql
-- ✗ Don't use self-referencing policies (infinite recursion)
CREATE POLICY "Check role" ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'  -- ❌ RECURSION!
  );

-- ✓ Use SECURITY DEFINER functions instead
CREATE POLICY "Check role" ON profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));  -- ✓ CORRECT
```

### 1.5 SECURITY DEFINER FUNCTIONS

#### ✅ MANDATORY PATTERN:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public  -- ⚠️ CRITICAL! Prevents privilege escalation
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

#### ❌ CRITICAL ERROR:

```sql
-- ✗ Missing SET search_path = public (SECURITY VULNERABILITY!)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
-- ❌ MISSING: SET search_path = public
AS $$
  SELECT EXISTS (...)
$$;
```

### 1.6 MIGRATION FILE NAMING

#### ✅ CORRECT FORMAT:

```
YYYYMMDDHHMMSS_description.sql

Examples:
20250128143022_add_tenant_id_to_products.sql
20250128143045_create_wholesale_orders_table.sql
20250128143100_add_rls_policies_to_orders.sql
```

#### ❌ WRONG FORMAT:

```
migration_1.sql           -- ❌ No timestamp
add-products.sql          -- ❌ No timestamp
2025-01-28_products.sql   -- ❌ Wrong format
```

### 1.7 CHECK CONSTRAINTS vs TRIGGERS

#### ✅ USE TRIGGERS (Recommended):

```sql
-- ✓ Validation trigger (can use NOW())
CREATE OR REPLACE FUNCTION validate_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expire_at <= NOW() THEN
    RAISE EXCEPTION 'Expiry date must be in the future';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_expiry_before_insert
  BEFORE INSERT OR UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION validate_expiry_date();
```

#### ❌ AVOID CHECK CONSTRAINTS FOR TIME:

```sql
-- ✗ CHECK with NOW() causes issues (not immutable)
ALTER TABLE table_name 
  ADD CONSTRAINT check_future_date 
  CHECK (expire_at > NOW());  -- ❌ Will fail on restore
```

---

## 🔧 PART 2: EDGE FUNCTION RULES

### 2.1 FILE STRUCTURE

#### ✅ REQUIRED:

```
supabase/functions/
├── _shared/
│   ├── deps.ts              ✓ Shared dependencies
│   ├── validation.ts        ✓ Validation utilities
│   ├── zen-firewall.ts      ✓ Security wrapper
│   └── schemas.ts           ✓ Zod schemas (create this!)
├── function-name/
│   ├── index.ts             ✓ Main function
│   └── validation.ts        ✓ Function-specific validation (optional)
```

#### ❌ FORBIDDEN:

```
supabase/functions/function-name/
├── subfolder/               ❌ No subfolders
│   └── helper.ts
├── utils/                   ❌ No subfolders
│   └── format.ts
```

### 2.2 EDGE FUNCTION TEMPLATE

#### ✅ COMPLETE TEMPLATE:

```typescript
// supabase/functions/function-name/index.ts

// 1. Import from shared deps
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// 2. Define Zod schema (MANDATORY)
const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  data: z.object({
    field1: z.string().min(1).max(255),
    field2: z.number().int().positive(),
  }),
});

type RequestBody = z.infer<typeof RequestSchema>;

// 3. Wrap with withZenProtection
serve(withZenProtection(async (req) => {
  // 4. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 5. Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    // 6. Parse and validate request body
    const rawBody = await req.json();
    const body = RequestSchema.parse(rawBody);

    // 7. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 8. Extract JWT user (if verify_jwt = true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 9. Verify tenant_id matches user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized tenant access" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 10. Business logic here
    const { data, error } = await supabase
      .from("table_name")
      .insert({
        ...body.data,
        tenant_id: body.tenant_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // 11. Return success response
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    // 12. Error handling
    console.error("Error in function-name:", error);

    // Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Validation failed", 
          details: error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Generic error
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}));
```

### 2.3 ZOD VALIDATION RULES

#### ✅ ALWAYS USE ZOD:

```typescript
// ✓ Define schema before function
const CreateOrderSchema = z.object({
  tenant_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
    price: z.number().positive(),
  })).min(1).max(50),
  delivery_address: z.string().min(10).max(500),
  payment_method: z.enum(["cash", "card", "crypto"]),
});

// ✓ Parse and validate
const body = CreateOrderSchema.parse(rawBody);
```

#### ❌ NEVER SKIP VALIDATION:

```typescript
// ✗ Don't trust raw input
const body = await req.json();
const { tenant_id, items } = body;  // ❌ No validation!

// ✗ Don't use basic checks
if (!tenant_id || !items) {  // ❌ Weak validation
  throw new Error("Missing fields");
}
```

### 2.4 SUPABASE CONFIG (supabase/config.toml)

#### ✅ CORRECT CONFIGURATION:

```toml
project_id = "aejugtmhwwknrowfyzie"  # ⚠️ MUST BE FIRST LINE! DON'T TOUCH!

# Public endpoints (no auth required)
[functions.track-access]
verify_jwt = false

[functions.menu-access-validate]
verify_jwt = false

[functions.tenant-signup]
verify_jwt = false

# Protected endpoints (auth required)
[functions.create-order]
verify_jwt = true

[functions.menu-generate]
verify_jwt = true

[functions.admin-actions]
verify_jwt = true
```

#### ❌ NEVER DO:

```toml
# ✗ Don't change project_id
project_id = "your-custom-id"  # ❌ AUTO-GENERATED!

# ✗ Don't add placeholders
[functions.my-function]
verify_jwt = ${VERIFY_JWT}  # ❌ No variables!

# ✗ Don't forget to add new functions
# If you create supabase/functions/new-function/index.ts
# You MUST add it to config.toml!
```

### 2.5 PASSWORD HASHING

#### ✅ CORRECT (Bcrypt):

```typescript
import { hash, compare } from "../_shared/deps.ts";

// ✓ Hash password (12 salt rounds)
const hashedPassword = await hash(plainPassword, 12);

// ✓ Verify password
const isValid = await compare(plainPassword, hashedPassword);
```

#### ❌ WRONG (SHA-256):

```typescript
// ✗ Don't use SHA-256 for passwords
const hash = encode(digest(password, "sha256"), "hex");  // ❌ INSECURE!
```

### 2.6 CORS RULES

#### ✅ ALWAYS:

```typescript
// 1. Define headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2. Handle OPTIONS
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

// 3. Include in ALL responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  status: 200,
});
```

---

## 🔗 PART 3: SCHEMA ↔ EDGE FUNCTION INTEGRATION

### 3.1 TENANT ISOLATION PATTERN

#### Database:

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL
);

CREATE POLICY "Tenant isolation"
  ON products FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );
```

#### Edge Function:

```typescript
// Extract tenant_id from JWT user
const { data: tenantUser } = await supabase
  .from("tenant_users")
  .select("tenant_id")
  .eq("user_id", user.id)
  .maybeSingle();

// ALWAYS filter by tenant_id
const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("tenant_id", tenantUser.tenant_id);  // ✓ Required!
```

### 3.2 ROLE-BASED ACCESS

#### Database:

```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role app_role NOT NULL
);

CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

#### Edge Function:

```typescript
// Check role via RPC
const { data: isAdmin } = await supabase
  .rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

if (!isAdmin) {
  return new Response(
    JSON.stringify({ error: "Admin access required" }),
    { status: 403, headers: corsHeaders }
  );
}
```

---

## ✅ PART 4: PRE-PUSH CHECKLIST

### Before Every Push:

```bash
# 1. TypeScript Check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build Test
npm run build

# 4. Validate Schema Rules
grep -r "REFERENCES auth.users" supabase/migrations/  # Should be empty
grep -r "SECURITY DEFINER" supabase/migrations/ | grep -v "search_path"  # Should be empty

# 5. Validate Edge Functions
# Check all edge functions have Zod validation
grep -r "z.object" supabase/functions/ --include="index.ts"

# Check all edge functions handle CORS
grep -r "OPTIONS" supabase/functions/ --include="index.ts"

# 6. Check Auto-Generated Files (should NOT be edited)
git diff src/integrations/supabase/client.ts  # Should be empty
git diff src/integrations/supabase/types.ts   # Should be empty
git diff supabase/config.toml | grep "project_id"  # Should be empty

# 7. Install pre-push hook
bash scripts/install-hooks.sh
```

---

## 🚨 CRITICAL NEVER-DOS

### 1. NEVER edit auto-generated files:
- ❌ `src/integrations/supabase/client.ts`
- ❌ `src/integrations/supabase/types.ts`
- ❌ `supabase/config.toml` (project_id line)
- ❌ `.env`

### 2. NEVER reference `auth.users`:
```sql
-- ❌ WRONG
CREATE TABLE orders (user_id UUID REFERENCES auth.users(id));

-- ✓ CORRECT
CREATE TABLE orders (user_id UUID REFERENCES public.profiles(user_id));
```

### 3. NEVER create `SECURITY DEFINER` without `search_path`:
```sql
-- ❌ SECURITY VULNERABILITY
CREATE FUNCTION my_func() SECURITY DEFINER AS $$ ... $$;

-- ✓ SECURE
CREATE FUNCTION my_func() 
SECURITY DEFINER 
SET search_path = public  -- ⚠️ REQUIRED!
AS $$ ... $$;
```

### 4. NEVER modify reserved schemas:
- ❌ `auth.*`
- ❌ `storage.*`
- ❌ `realtime.*`
- ❌ `vault.*`
- ❌ `supabase_functions.*`

### 5. NEVER skip tenant_id validation in Edge Functions:
```typescript
// ❌ WRONG - Data leak risk
const { data } = await supabase.from("products").select("*");

// ✓ CORRECT
const { data } = await supabase
  .from("products")
  .select("*")
  .eq("tenant_id", tenant_id);
```

### 6. NEVER skip Zod validation:
```typescript
// ❌ WRONG
const body = await req.json();

// ✓ CORRECT
const rawBody = await req.json();
const body = RequestSchema.parse(rawBody);
```

### 7. NEVER use weak RLS policies:
```sql
-- ❌ WRONG - Allows everything
CREATE POLICY "Allow all" ON table_name FOR ALL USING (true);

-- ✓ CORRECT - Tenant isolation
CREATE POLICY "Tenant access" ON table_name FOR ALL 
USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
```

---

## 📝 QUICK REFERENCE CARD

### Creating New Table:
1. ✅ Add `tenant_id UUID` column (if multi-tenant)
2. ✅ Reference `public.profiles` (not `auth.users`)
3. ✅ Create indexes on FKs and query columns
4. ✅ Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
5. ✅ Create tenant isolation policy
6. ✅ Use trigger validation (not CHECK) for time-based rules

### Creating New Edge Function:
1. ✅ Import from `_shared/deps.ts`
2. ✅ Define Zod schema
3. ✅ Wrap with `withZenProtection`
4. ✅ Handle OPTIONS for CORS
5. ✅ Validate all inputs with Zod
6. ✅ Extract JWT user and validate tenant
7. ✅ Add to `supabase/config.toml`
8. ✅ Return CORS headers in ALL responses

### Files You Can NEVER Edit:
- ❌ `src/integrations/supabase/client.ts`
- ❌ `src/integrations/supabase/types.ts`
- ❌ `supabase/config.toml` (project_id)
- ❌ `.env`

