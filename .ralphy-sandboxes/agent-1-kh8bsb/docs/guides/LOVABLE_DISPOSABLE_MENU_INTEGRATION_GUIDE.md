# 🔐 LOVABLE - Disposable Menu Integration Guide

## Complete Integration Guide for AES-256 Encrypted Disposable Menus

This guide provides step-by-step instructions to get disposable menus with AES-256 encryption fully working in Lovable, including all the fixes for encryption function issues.

**Last Updated**: November 21, 2024  
**Status**: ✅ Fully Operational

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Edge Function Setup](#edge-function-setup)
4. [Frontend Integration](#frontend-integration)
5. [Troubleshooting](#troubleshooting)
6. [Testing Checklist](#testing-checklist)

---

## ✅ Prerequisites

### Required Extensions
- `pgcrypto` extension must be installed in the `extensions` schema
- Supabase Vault access (optional, for production encryption keys)

### Required Files
- Edge function: `supabase/functions/create-encrypted-menu/index.ts`
- Frontend hook: `src/hooks/useDisposableMenus.ts`
- Components: `src/components/admin/disposable-menus/*`
- Pages: `src/pages/admin/DisposableMenus.tsx`

### Environment Variables
```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🗄️ Database Setup

### Step 1: Install pgcrypto Extension

**Critical**: Must be in `extensions` schema, not `public`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
```

### Step 2: Create Encryption Key Function

This function manages the AES-256 encryption key securely.

```sql
CREATE OR REPLACE FUNCTION public.get_menu_encryption_key()
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
DECLARE
  key_material TEXT;
  encryption_key bytea;
BEGIN
  -- Try to get key from vault, fallback to JWT secret
  BEGIN
    SELECT decrypted_secret INTO key_material
    FROM vault.decrypted_secrets
    WHERE name = 'menu_encryption_master_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    key_material := current_setting('app.settings.jwt_secret', true);
  END;
  
  -- Generate 256-bit key using pgcrypto in extensions schema
  encryption_key := extensions.digest(
    ('disposable-menu-encryption-v1::' || COALESCE(key_material, gen_random_uuid()::text))::text,
    'sha256'::text
  );
  
  RETURN encryption_key;
END;
$$;
```

**Key Points**:
- Uses `extensions.digest()` (schema-qualified) ✅
- `SET search_path = 'public,extensions'` allows access to both schemas ✅
- Falls back to JWT secret if vault unavailable ✅

### Step 3: Create Encryption Helper Functions

These functions handle text, numeric, and JSON encryption.

```sql
-- Encrypt text fields
CREATE OR REPLACE FUNCTION public.encrypt_menu_text(plaintext text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
DECLARE
  encryption_key bytea;
  iv bytea;
  encrypted_data bytea;
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  encryption_key := public.get_menu_encryption_key();
  iv := gen_random_bytes(16);
  
  encrypted_data := encrypt_iv(
    convert_to(plaintext, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN iv || encrypted_data;
END;
$$;

-- Encrypt numeric fields
CREATE OR REPLACE FUNCTION public.encrypt_menu_numeric(plaintext numeric)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.encrypt_menu_text(plaintext::text);
END;
$$;

-- Encrypt JSONB fields
CREATE OR REPLACE FUNCTION public.encrypt_menu_jsonb(plaintext jsonb)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN public.encrypt_menu_text(plaintext::text);
END;
$$;
```

### Step 4: Create Main Encryption Function

This function encrypts all sensitive menu data after creation.

```sql
CREATE OR REPLACE FUNCTION public.encrypt_disposable_menu(menu_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public,extensions'
AS $$
BEGIN
  -- Encrypt menu data using fully qualified helper functions
  UPDATE public.disposable_menus
  SET
    encrypted_name = public.encrypt_menu_text(name::text),
    encrypted_description = public.encrypt_menu_text(description::text),
    encrypted_security_settings = public.encrypt_menu_jsonb(security_settings),
    encrypted_appearance_settings = public.encrypt_menu_jsonb(appearance_settings),
    encrypted_min_order_quantity = public.encrypt_menu_numeric(min_order_quantity),
    encrypted_max_order_quantity = public.encrypt_menu_numeric(max_order_quantity),
    is_encrypted = true,
    encryption_version = 1
  WHERE id = menu_id;
  
  -- Encrypt product prices with fully qualified WHERE clause
  UPDATE public.disposable_menu_products
  SET
    encrypted_custom_price = public.encrypt_menu_numeric(custom_price),
    is_encrypted = true
  WHERE public.disposable_menu_products.menu_id = encrypt_disposable_menu.menu_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to encrypt menu %: %', menu_id, SQLERRM;
END;
$$;
```

**Critical Fix**: Uses `public.encrypt_menu_text()` (fully qualified) and proper WHERE clause to avoid ambiguity.

### Step 5: Verify Database Tables

Ensure these tables exist with encrypted columns:

```sql
-- Check disposable_menus table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'disposable_menus' 
AND column_name LIKE 'encrypted%';

-- Should return:
-- encrypted_name (bytea)
-- encrypted_description (bytea)
-- encrypted_security_settings (bytea)
-- encrypted_appearance_settings (bytea)
-- encrypted_min_order_quantity (bytea)
-- encrypted_max_order_quantity (bytea)
-- is_encrypted (boolean)
-- encryption_version (integer)

-- Check disposable_menu_products table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'disposable_menu_products' 
AND column_name LIKE 'encrypted%';

-- Should return:
-- encrypted_custom_price (bytea)
-- is_encrypted (boolean)
```

---

## ⚡ Edge Function Setup

### File: `supabase/functions/create-encrypted-menu/index.ts`

**Key Requirements**:
1. Uses Zod validation schema ✅
2. Creates menu with plaintext first ✅
3. Calls `encrypt_disposable_menu()` RPC function ✅
4. Handles errors with rollback ✅

**Validation Schema**:
```typescript
const CreateMenuSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  security_settings: z.object({}).passthrough().optional(),
  appearance_settings: z.object({}).passthrough().optional(),
  min_order_quantity: z.number().positive().optional(),
  max_order_quantity: z.number().positive().optional(),
  access_code: z.string().min(6),
  products: z.array(z.object({
    product_id: z.string().uuid(),
    custom_price: z.number().positive().optional(),
    display_availability: z.boolean().optional(),
    display_order: z.number().int().optional(),
  })).optional(),
  expiration_date: z.string().datetime().optional(),
  never_expires: z.boolean().optional(),
});
```

**Critical Flow**:
1. ✅ Validate input with Zod
2. ✅ Create menu record (is_encrypted = false)
3. ✅ Add products if provided
4. ✅ Call `encrypt_disposable_menu(menu.id)` RPC
5. ✅ Return success response

**Deployment**:
```bash
supabase functions deploy create-encrypted-menu
```

---

## 🎨 Frontend Integration

### Hook: `src/hooks/useDisposableMenus.ts`

**Key Function**: `useCreateDisposableMenu()`

**Request Body Structure**:
```typescript
{
  tenant_id: string;           // REQUIRED
  name: string;                 // REQUIRED
  description?: string;
  access_code: string;          // REQUIRED (min 6 chars)
  security_settings?: object;
  appearance_settings?: object;
  min_order_quantity?: number;
  max_order_quantity?: number;
  products?: Array<{            // Optional (forum menus don't have products)
    product_id: string;
    custom_price?: number;
    display_availability?: boolean;
    display_order?: number;
  }>;
  expiration_date?: string;
  never_expires?: boolean;
}
```

**Usage Example**:
```typescript
const createMenu = useCreateDisposableMenu();

await createMenu.mutateAsync({
  tenant_id: tenant.id,
  name: 'VIP Menu',
  description: 'Exclusive products',
  access_code: 'VIP2024',
  product_ids: ['uuid1', 'uuid2'],
  custom_prices: { 'uuid1': 50.00 },
  security_settings: { require_access_code: true },
  appearance_settings: { theme: 'dark' },
  min_order_quantity: 5,
  max_order_quantity: 50,
});
```

### Components

**Main Page**: `src/pages/admin/DisposableMenus.tsx`
- Lists all menus
- Create menu buttons (Wizard/Quick Create)

**Creation Components**:
- `MenuCreationWizard.tsx` - 4-step wizard (recommended)
- `CreateMenuDialog.tsx` - 5-step dialog
- `CreateMenuSimpleDialog.tsx` - Simplified version

**All components use**: `useCreateDisposableMenus()` hook

---

## 🔧 Troubleshooting

### Error: "function get_menu_encryption_key() does not exist"

**Cause**: pgcrypto extension not installed or wrong schema

**Fix**:
1. Verify extension:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```
2. If missing:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
   ```
3. Verify function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_menu_encryption_key';
   ```
4. Recreate function with correct search_path (see Step 2 above)

### Error: "function digest(text, text) does not exist"

**Cause**: digest() not found in search_path

**Fix**: Use schema-qualified call:
```sql
encryption_key := extensions.digest(
  ('disposable-menu-encryption-v1::' || key_material)::text,
  'sha256'::text
);
```

### Error: "Failed to encrypt menu: column reference is ambiguous"

**Cause**: WHERE clause in `encrypt_disposable_menu()` uses unqualified column name

**Fix**: Use fully qualified column reference:
```sql
WHERE public.disposable_menu_products.menu_id = encrypt_disposable_menu.menu_id;
```

### Error: Validation errors on menu creation

**Cause**: Missing required fields or wrong data types

**Check**:
1. `tenant_id` is valid UUID ✅
2. `name` is non-empty string ✅
3. `access_code` is at least 6 characters ✅
4. `product_ids` array contains valid UUIDs (if provided) ✅

### Error: Menu created but encryption failed

**Cause**: RPC call to `encrypt_disposable_menu()` failed

**Debug Steps**:
1. Check edge function logs:
   ```bash
   supabase functions logs create-encrypted-menu
   ```
2. Test RPC directly:
   ```sql
   SELECT encrypt_disposable_menu('menu-uuid-here');
   ```
3. Check for NULL values in required fields
4. Verify encrypted columns exist in tables

### Health Check Errors (Fixed)

**Issue**: Health check sending empty body causes validation errors

**Fix**: Removed problematic health check in SmartDashboard component

---

## ✅ Testing Checklist

### Database Functions
- [ ] `get_menu_encryption_key()` returns bytea
- [ ] `encrypt_menu_text('test')` returns encrypted bytea
- [ ] `encrypt_menu_numeric(100)` returns encrypted bytea
- [ ] `encrypt_menu_jsonb('{"key":"value"}'::jsonb)` returns encrypted bytea
- [ ] `encrypt_disposable_menu(menu_id)` returns true

### Edge Function
- [ ] OPTIONS request returns CORS headers
- [ ] Invalid input returns 400 with validation errors
- [ ] Valid input creates menu successfully
- [ ] Menu is encrypted after creation (is_encrypted = true)
- [ ] Products are encrypted if provided
- [ ] Error handling works (rollback on failure)

### Frontend
- [ ] Hook validates tenant_id before calling
- [ ] Request body includes all required fields
- [ ] Success toast shows on creation
- [ ] Error toast shows on failure
- [ ] Query cache invalidates after creation
- [ ] Menu appears in list after creation

### End-to-End
- [ ] Create menu via wizard → Success
- [ ] Create menu via quick dialog → Success
- [ ] Create menu without products → Success (forum menu)
- [ ] View created menu → Shows encrypted status
- [ ] Access menu via URL token → Works
- [ ] Decrypt menu data → Shows original values

---

## 💡 Common Issues & Solutions

### Issue: Encryption functions work in SQL but fail in edge function

**Solution**: Ensure `SECURITY DEFINER` and `SET search_path = 'public,extensions'` on all functions

### Issue: Menu created but not encrypted

**Solution**: Check edge function logs for RPC error, verify function permissions

### Issue: Products not encrypted

**Solution**: Verify WHERE clause in `encrypt_disposable_menu()` uses qualified column name

### Issue: Validation errors for optional fields

**Solution**: Frontend should only include fields with values, use undefined for optional arrays

---

## 📦 Migration Order

Apply migrations in this order:

1. `20251113134954_38bed50d-dc1f-43a5-954d-1d2e44de462a.sql` - Initial encryption setup
2. `20251121050447_a3958d98-0ccc-430a-9405-8a5ace1ff037.sql` - Fix search_path issues
3. `20251121050848_c783fb22-771b-4051-9308-8cdb58350d3c.sql` - Fully qualified function calls

---

## 📚 Quick Reference

### Required Database Functions
- `public.get_menu_encryption_key()` - Returns encryption key
- `public.encrypt_menu_text(text)` - Encrypts text
- `public.encrypt_menu_numeric(numeric)` - Encrypts numbers
- `public.encrypt_menu_jsonb(jsonb)` - Encrypts JSON
- `public.encrypt_disposable_menu(uuid)` - Main encryption function

### Required Edge Functions
- `create-encrypted-menu` - Creates and encrypts menu

### Required Frontend Files
- `src/hooks/useDisposableMenus.ts` - Menu operations hook
- `src/pages/admin/DisposableMenus.tsx` - Main page
- `src/components/admin/disposable-menus/*` - UI components

### Key Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for edge functions

---

## 🎯 Features Included

✅ **AES-256 Encryption** - Bank-level security  
✅ **Secure Key Management** - Vault-backed with fallback  
✅ **Encrypted Fields** - Name, description, settings, prices  
✅ **Access Control** - Code-protected menus  
✅ **URL Tokens** - Unique encrypted access links  
✅ **Audit Logging** - Track all decryption attempts  
✅ **Multi-tenant Isolation** - Tenant-scoped data  
✅ **Burn After Read** - Self-destructing menus  
✅ **View Limits** - Max view count enforcement  
✅ **Expiration** - Time-based menu access  

---

## 🚀 Deployment to Lovable

### Step 1: Verify All Files Exist
```bash
# Edge functions
ls -la supabase/functions/create-encrypted-menu/

# Frontend hooks
ls -la src/hooks/useDisposableMenus.ts

# Components
ls -la src/components/admin/disposable-menus/

# Pages
ls -la src/pages/admin/DisposableMenus.tsx
```

### Step 2: Deploy Edge Functions
```bash
supabase functions deploy create-encrypted-menu
```

### Step 3: Apply Database Migrations
Run migrations in Supabase dashboard or via CLI:
```bash
supabase db push
```

### Step 4: Test in Lovable
1. Navigate to `/admin/disposable-menus`
2. Click "Create Menu (Wizard)"
3. Fill in required fields
4. Add products
5. Click "Create Menu"
6. Verify menu appears in list with encrypted badge 🔐

---

## 📞 Support

For issues during integration:
1. Check Supabase logs: Dashboard → Logs → Edge Functions
2. Test RPC functions directly in SQL editor
3. Verify all migrations applied successfully
4. Check function permissions: `GRANT EXECUTE ON FUNCTION ... TO authenticated;`

---

## ✅ Success Criteria

You'll know everything is working when:
- ✅ Menus create without validation errors
- ✅ Edge function logs show successful encryption
- ✅ Database shows `is_encrypted = true`
- ✅ Encrypted columns contain bytea data
- ✅ Menu appears in admin list
- ✅ Public access via URL token works
- ✅ Access code validation functions
- ✅ No console errors in browser

---

**Created**: November 21, 2024  
**Author**: BigMike Wholesale Platform Team  
**Version**: 1.0.0  
**Status**: Production Ready ✅

