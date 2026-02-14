# 📚 Complete Button & Function Implementation Rules

**Last Updated:** Based on standardized dependency management

---

## 🎯 PART 1: BUTTON IMPLEMENTATION RULES

### 1.1 Basic Button Pattern

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleAction = async () => {
  // Prevent double-clicks
  if (isLoading) return;

  setIsLoading(true);
  try {
    // Your logic here
    const { data, error } = await invokeEdgeFunction({
      functionName: 'your-function-name',
      body: { /* data */ }
    });

    if (error) throw error;

    toast.success("Action completed successfully!");

    // Update UI state, close dialogs, etc.

  } catch (error: unknown) {
    logger.error('Action failed', error, { 
      component: 'ComponentName',
      action: 'actionName'
    });

    const message = error instanceof Error 
      ? error.message 
      : 'Something went wrong';
    toast.error(message);
  } finally {
    setIsLoading(false);
  }
};

return (
  <Button onClick={handleAction} disabled={isLoading}>
    {isLoading ? 'Processing...' : 'Submit'}
  </Button>
);
```

### 1.2 Mandatory Button Rules

✅ **ALWAYS:**

1. **Loading State**: Use `isLoading` state and disable button during operations
2. **Error Handling**: Wrap in try-catch-finally
3. **User Feedback**: Show toast.success on success, toast.error on failure
4. **Logger**: Use `logger.error()` for errors (NOT console.log)
5. **Type Safety**: Use `error: unknown` and type guard
6. **Prevent Double Submit**: Check loading state at function start
7. **Loading Text**: Change button text during loading ("Processing...", "Saving...")

❌ **NEVER:**

1. Don't use `console.log` (use `logger`)
2. Don't leave buttons enabled during async operations
3. Don't skip error handling
4. Don't use `any` type (use `unknown`)
5. Don't forget to reset loading state in `finally`

### 1.3 Destructive Actions (Delete, Remove, etc.)

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const { error } = await invokeEdgeFunction({
      functionName: 'delete-item',
      body: { id: itemId }
    });

    if (error) throw error;

    toast.success("Item deleted successfully");
    // Close dialog, refresh data, etc.

  } catch (error: unknown) {
    logger.error('Delete failed', error, { component: 'MyComponent' });
    toast.error(error instanceof Error ? error.message : 'Delete failed');
  } finally {
    setIsDeleting(false);
  }
};

return (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive">Delete</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete the item.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
```

### 1.4 Form Submit Buttons

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
});

type FormData = z.infer<typeof formSchema>;

const form = useForm({
  resolver: zodResolver(formSchema),
});

const onSubmit = async (data: FormData) => {
  try {
    const { error } = await invokeEdgeFunction({
      functionName: 'create-item',
      body: data
    });

    if (error) throw error;

    toast.success("Item created successfully!");
    form.reset();

  } catch (error: unknown) {
    logger.error('Form submission failed', error, { 
      component: 'MyForm',
      formData: data
    });
    toast.error(error instanceof Error ? error.message : 'Submission failed');
  }
};

return (
  <form onSubmit={form.handleSubmit(onSubmit)}>
    {/* Form fields */}
    <Button type="submit" disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting ? 'Saving...' : 'Save'}
    </Button>
  </form>
);
```

---

## 🔧 PART 2: EDGE FUNCTION RULES

### 2.1 Complete Edge Function Template

```typescript
// supabase/functions/your-function-name/index.ts

// ⚠️ CRITICAL: Always use shared deps to prevent version conflicts
import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

// 1. Define Zod validation schema (MANDATORY)
const RequestSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  quantity: z.number().int().positive().max(1000),
});

type RequestBody = z.infer<typeof RequestSchema>;

// 2. Wrap with security protection
serve(withZenProtection(async (req) => {
  // 3. Handle CORS preflight (MANDATORY)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 4. Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    // 5. Parse and validate request body with Zod
    const rawBody = await req.json();
    const body = RequestSchema.parse(rawBody);

    // 6. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 7. Authenticate user (if verify_jwt = true in config.toml)
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

    // 8. Verify tenant access (CRITICAL for multi-tenant)
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

    // 9. Business logic - Database operations
    const { data, error: dbError } = await supabase
      .from("your_table")
      .insert({
        tenant_id: body.tenant_id,
        name: body.name,
        email: body.email,
        quantity: body.quantity,
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 10. Return success response with CORS
    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        message: "Operation completed successfully"
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    // ⚠️ Note: console.log is OK in edge functions (server-side)
    console.error("Error in your-function-name:", error);

    // Handle Zod validation errors
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

    // Handle generic errors
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}));
```

### 2.2 Edge Function Configuration

```toml
# supabase/config.toml

project_id = "aejugtmhwwknrowfyzie"  # ⚠️ NEVER TOUCH THIS LINE!

# For authenticated endpoints (default)
[functions.your-function-name]
verify_jwt = true

# For public endpoints (no auth required)
[functions.public-function]
verify_jwt = false
```

### 2.3 Dependency Management (CRITICAL)

**⚠️ ALWAYS use shared deps.ts to prevent version conflicts:**

```typescript
// ✅ CORRECT - Use shared deps
import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";

// ❌ WRONG - Direct imports cause build conflicts
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

**Available from `_shared/deps.ts`:**
- `serve` - HTTP server
- `createClient` - Supabase client
- `corsHeaders` - CORS headers object
- `z` - Zod validation
- `hash`, `compare` - Bcrypt password hashing

---

## 🗄️ PART 3: DATABASE SCHEMA RULES

### 3.1 Create Table with Tenant Isolation

```sql
-- Step 1: Create table
CREATE TABLE public.your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Add indexes
CREATE INDEX idx_your_table_tenant_id ON public.your_table(tenant_id);
CREATE INDEX idx_your_table_created_at ON public.your_table(created_at);

-- Step 3: Enable RLS (MANDATORY)
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
CREATE POLICY "Tenant users can view their data"
  ON public.your_table FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can insert their data"
  ON public.your_table FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can update their data"
  ON public.your_table FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can delete their data"
  ON public.your_table FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- Step 5: Add updated_at trigger
CREATE TRIGGER update_your_table_updated_at
  BEFORE UPDATE ON public.your_table
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 3.2 Database Constraints

```sql
-- Check constraints
ALTER TABLE your_table 
  ADD CONSTRAINT check_quantity_positive 
  CHECK (quantity >= 0);

ALTER TABLE your_table
  ADD CONSTRAINT check_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Unique constraints
ALTER TABLE your_table
  ADD CONSTRAINT unique_email_per_tenant 
  UNIQUE (tenant_id, email);
```

---

## 🔗 PART 4: COMPLETE IMPLEMENTATION FLOW

### Step 1: Create Database Schema

```sql
-- Create table with tenant isolation and RLS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for products"
  ON public.products FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
```

### Step 2: Create Edge Function

```typescript
// supabase/functions/create-product/index.ts
// ⚠️ IMPORTANT: Use shared deps to prevent version conflicts
import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

const ProductSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
});

serve(withZenProtection(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = ProductSchema.parse(await req.json());
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("products")
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
```

### Step 3: Create Frontend Component

```typescript
// src/components/CreateProductDialog.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invokeEdgeFunction } from "@/utils/edgeFunctionHelper";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const formSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
});

export function CreateProductDialog() {
  const { tenant } = useTenantAdminAuth();
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!tenant?.id) return;

    setIsCreating(true);
    try {
      const { error } = await invokeEdgeFunction({
        functionName: 'create-product',
        body: {
          ...data,
          tenant_id: tenant.id,
        },
      });

      if (error) throw error;

      toast.success("Product created successfully!");
      form.reset();

    } catch (error: unknown) {
      logger.error('Failed to create product', error, {
        component: 'CreateProductDialog',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to create product');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
      <Button type="submit" disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Product'}
      </Button>
    </form>
  );
}
```

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Database:
- [ ] Table created with `tenant_id` column
- [ ] RLS enabled on table
- [ ] RLS policies created for tenant isolation
- [ ] Indexes created on `tenant_id` and frequently queried columns
- [ ] Foreign keys reference `public.profiles`, NOT `auth.users`

### Edge Function:
- [ ] **Uses `_shared/deps.ts` for all imports** (CRITICAL)
- [ ] Zod validation schema defined
- [ ] CORS headers returned in all responses
- [ ] OPTIONS request handled
- [ ] Environment variables validated
- [ ] User authentication checked (if required)
- [ ] Tenant access verified
- [ ] Error handling for validation and database errors
- [ ] Wrapped with `withZenProtection` (if security needed)

### Frontend:
- [ ] Loading state managed (`isLoading`)
- [ ] Button disabled during operations
- [ ] Error handling with try-catch
- [ ] `logger.error()` used for errors (NOT console.log)
- [ ] `toast.success()` for success
- [ ] `toast.error()` for errors
- [ ] Confirmation dialog for destructive actions
- [ ] Form validation with Zod

---

## 🚨 CRITICAL REMINDERS

1. **Dependency Management**: ALWAYS use `_shared/deps.ts` in edge functions. Direct imports cause build conflicts.

2. **Tenant Isolation**: Every table MUST have `tenant_id` and RLS policies.

3. **Error Handling**: Use `error: unknown` and type guards, never `any`.

4. **Logging**: Use `logger` in frontend, `console.log` is OK in edge functions (server-side).

5. **CORS**: Always return CORS headers in edge function responses.

6. **Authentication**: Verify JWT and tenant access in edge functions.

7. **Validation**: Always validate input with Zod in both frontend and edge functions.

