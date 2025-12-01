# Deployment Checklist: Product + Barcode + Menu Auto-Sync

## Pre-Deployment Verification

### ✅ Code Quality
- [x] No linter errors
- [x] All TypeScript types correct
- [x] All error handling uses `error: unknown`
- [x] All logging uses `logger` utility (no console.log)
- [x] All queries filter by `tenant_id`
- [x] All Edge Functions have Zod validation
- [x] All Edge Functions handle CORS

### ✅ Database Migrations
- [x] `20250210113916_product_barcode_menu_sync.sql` - Schema updates
- [x] `20250210113917_generate_product_sku.sql` - SKU generation functions
- [x] `20250210113918_menu_visibility_trigger.sql` - Menu visibility triggers
- [x] `20250210113919_storage_bucket_setup.sql` - Storage documentation

### ✅ Edge Functions
- [x] `generate-product-barcode/index.ts` - Created and validated
- [x] `sync-product-to-menu/index.ts` - Created and validated
- [x] Edge Function configs added to `supabase/config.toml`

### ✅ Client Code
- [x] `src/lib/utils/skuGenerator.ts` - Created
- [x] `src/lib/utils/barcodeStorage.ts` - Created
- [x] `src/lib/utils/menuSync.ts` - Created
- [x] `src/lib/utils/labelGenerator.ts` - Created
- [x] `src/components/admin/ProductLabel.tsx` - Created
- [x] `src/pages/admin/ProductManagement.tsx` - Updated
- [x] `src/components/admin/ProductCard.tsx` - Updated
- [x] `src/components/admin/EnhancedProductTable.tsx` - Updated

## Deployment Steps

### 1. Database Migrations

```bash
# Apply migrations in order
supabase migration up
```

Or via Supabase Dashboard:
1. Go to Database → Migrations
2. Apply each migration in order:
   - `20250210113916_product_barcode_menu_sync.sql`
   - `20250210113917_generate_product_sku.sql`
   - `20250210113918_menu_visibility_trigger.sql`
   - `20250210113919_storage_bucket_setup.sql` (documentation only)

### 2. Deploy Edge Functions

```bash
# Deploy both Edge Functions
supabase functions deploy generate-product-barcode
supabase functions deploy sync-product-to-menu
```

Or via Supabase Dashboard:
1. Go to Edge Functions
2. Deploy `generate-product-barcode`
3. Deploy `sync-product-to-menu`

### 3. Configure Storage Bucket

The bucket will be created automatically by the Edge Function, but you should verify:

1. Go to Storage → Buckets
2. Verify `product-barcodes` bucket exists
3. If it doesn't exist, create it with:
   - Name: `product-barcodes`
   - Public: `true`
   - File size limit: `1048576` (1MB)
   - Allowed MIME types: `image/svg+xml`, `image/png`

### 4. Configure RLS Policies

After bucket creation, configure RLS policies via Supabase Dashboard:

1. Go to Storage → Policies → `product-barcodes`
2. Create policies:
   - **Public Read**: Allow `SELECT` for `public` role
   - **Tenant Upload**: Allow `INSERT` for `authenticated` role (tenant folder only)
   - **Tenant Management**: Allow `UPDATE`/`DELETE` for `authenticated` role (tenant folder only)

Or use SQL:

```sql
-- Public read access
CREATE POLICY "Public can read barcodes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-barcodes');

-- Tenant upload access
CREATE POLICY "Users can upload barcodes for their tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-barcodes' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tenants
    WHERE id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- Tenant management access
CREATE POLICY "Users can manage barcodes for their tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-barcodes' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tenants
    WHERE id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

CREATE POLICY "Users can delete barcodes for their tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-barcodes' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.tenants
    WHERE id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);
```

### 5. Test Deployment

#### Test 1: Create Product with Auto-SKU
1. Go to Product Management
2. Click "Add Product"
3. Fill in product details (leave SKU empty)
4. Select a category (e.g., "flower")
5. Set available quantity > 0
6. Submit
7. **Expected**: SKU auto-generated (e.g., `FLOW-0001`)

#### Test 2: Verify Barcode Generation
1. After product creation, check product details
2. **Expected**: `barcode_image_url` field populated
3. **Expected**: Barcode image visible in product card/table

#### Test 3: Verify Menu Sync
1. Create product with stock > 0
2. Go to Disposable Menus
3. **Expected**: Product appears in menu
4. Update product stock to 0
5. **Expected**: Product disappears from menu

#### Test 4: Verify Label Generation
1. Go to Product Management
2. Find a product with SKU
3. Click "Print Label" (in dropdown menu)
4. **Expected**: Label preview dialog opens
5. Click "Download PDF"
6. **Expected**: PDF downloads with 4" x 2" label
7. Click "Print"
8. **Expected**: Print dialog opens (label-only, not full page)

#### Test 5: Verify Tenant Isolation
1. Create product in Tenant A
2. Switch to Tenant B
3. **Expected**: Tenant A's products not visible
4. Create product in Tenant B with same category
5. **Expected**: SKU starts from 0001 (separate sequence)

#### Test 6: Verify Duplicate Function
1. Duplicate a product
2. **Expected**: New SKU generated
3. **Expected**: New barcode generated
4. **Expected**: Product name has "(Copy)" suffix

## Post-Deployment Monitoring

### Check Logs
1. Monitor Edge Function logs for errors
2. Check database logs for trigger execution
3. Monitor storage uploads

### Common Issues

#### Issue: SKU Generation Fails
**Symptoms**: Product created but SKU is null
**Solution**: 
- Check database function `generate_product_sku` exists
- Verify `product_sku_sequences` table exists
- Check RLS policies on `product_sku_sequences`

#### Issue: Barcode Not Generated
**Symptoms**: Product created but `barcode_image_url` is null
**Solution**:
- Check Edge Function logs
- Verify `product-barcodes` bucket exists
- Check barcodeapi.org API is accessible
- Verify Edge Function has storage permissions

#### Issue: Product Not Appearing in Menus
**Symptoms**: Product with stock > 0 not in menu
**Solution**:
- Check `menu_visibility` column value
- Verify trigger `trigger_update_menu_visibility` exists
- Check Edge Function `sync-product-to-menu` logs
- Verify `disposable_menus` table has active menus

#### Issue: Label PDF Not Generating
**Symptoms**: Print label button doesn't work
**Solution**:
- Check browser console for errors
- Verify `jspdf` package is installed
- Check barcode image URL is accessible (CORS)
- Verify product has SKU

## Rollback Plan

If issues occur, rollback steps:

1. **Disable Triggers**:
```sql
DROP TRIGGER IF EXISTS trigger_update_menu_visibility ON public.products;
DROP TRIGGER IF EXISTS trigger_set_menu_visibility_on_insert ON public.products;
```

2. **Remove Functions**:
```sql
DROP FUNCTION IF EXISTS public.generate_product_sku(TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_category_prefix(TEXT);
DROP FUNCTION IF EXISTS public.update_menu_visibility();
DROP FUNCTION IF EXISTS public.set_menu_visibility_on_insert();
```

3. **Remove Columns** (if needed):
```sql
ALTER TABLE public.products 
  DROP COLUMN IF EXISTS barcode_image_url,
  DROP COLUMN IF EXISTS menu_visibility;
```

4. **Remove Table**:
```sql
DROP TABLE IF EXISTS public.product_sku_sequences;
```

5. **Undeploy Edge Functions**:
```bash
supabase functions delete generate-product-barcode
supabase functions delete sync-product-to-menu
```

## Success Criteria

✅ All migrations applied successfully
✅ Edge Functions deployed and accessible
✅ Storage bucket created and configured
✅ RLS policies configured
✅ Product creation with auto-SKU works
✅ Barcode generation works
✅ Menu auto-sync works
✅ Label generation works
✅ Tenant isolation verified
✅ No errors in logs

## Support

If issues persist:
1. Check Supabase Dashboard logs
2. Review Edge Function logs
3. Check browser console for client errors
4. Verify all environment variables are set
5. Review documentation in `docs/PRODUCT_BARCODE_MENU_SYNC_IMPLEMENTATION.md`

