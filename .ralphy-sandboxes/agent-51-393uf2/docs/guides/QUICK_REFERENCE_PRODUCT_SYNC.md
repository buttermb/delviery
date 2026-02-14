# Quick Reference: Product + Barcode + Menu Auto-Sync

## 🚀 Quick Start

### For Developers

#### Create a Product with Auto-SKU
```typescript
import { generateProductSKU } from '@/lib/utils/skuGenerator';
import { generateAndStoreBarcode } from '@/lib/utils/barcodeStorage';
import { syncProductToMenus } from '@/lib/utils/menuSync';

// In your component
const category = 'flower';
const tenantId = tenant.id;

// Auto-generate SKU
const sku = await generateProductSKU(category, tenantId);
// Returns: "FLOW-0001"

// Generate and store barcode
const barcodeUrl = await generateAndStoreBarcode(sku, tenantId);
// Returns: "https://...product-barcodes/.../FLOW-0001.png"

// Create product
const { data: product } = await supabase
  .from('products')
  .insert({
    name: 'Blue Dream',
    sku,
    barcode_image_url: barcodeUrl,
    category,
    available_quantity: 10,
    tenant_id: tenantId,
  })
  .select()
  .single();

// Auto-sync to menus (if stock > 0)
if (product && product.available_quantity > 0) {
  await syncProductToMenus(product.id, tenantId);
}
```

#### Generate Product Label
```typescript
import { downloadProductLabel } from '@/lib/utils/labelGenerator';

await downloadProductLabel({
  productName: 'Blue Dream',
  strainName: 'Runtz',
  strainType: 'Hybrid',
  sku: 'FLOW-0001',
  barcodeImageUrl: 'https://...',
  barcodeValue: 'FLOW-0001',
});
```

### For Database Admins

#### Check SKU Sequences
```sql
SELECT * FROM product_sku_sequences 
WHERE tenant_id = 'your-tenant-id'
ORDER BY category, last_number;
```

#### Check Menu Visibility
```sql
SELECT id, name, available_quantity, menu_visibility 
FROM products 
WHERE tenant_id = 'your-tenant-id'
ORDER BY menu_visibility DESC, name;
```

#### Manually Sync Product to Menu
```sql
-- Check if product should be in menus
SELECT id, name, available_quantity, menu_visibility
FROM products
WHERE id = 'product-id';

-- If menu_visibility = true, product should be in menus
-- The Edge Function handles the actual sync
```

### For Edge Function Developers

#### Test Barcode Generation
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-product-barcode \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "FLOW-0001",
    "tenant_id": "your-tenant-id"
  }'
```

#### Test Menu Sync
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-product-to-menu \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "product-id",
    "tenant_id": "your-tenant-id"
  }'
```

## 📋 Category Prefixes

| Category | Prefix | Example SKU |
|----------|--------|-------------|
| flower | FLOW | FLOW-0001 |
| vapes | VAPE | VAPE-0001 |
| edibles | EDIB | EDIB-0001 |
| concentrates | CONC | CONC-0001 |
| Other | PRD | PRD-0001 |

## 🔧 Common Tasks

### Update Product Stock
```typescript
// Stock update automatically triggers menu visibility update
await supabase
  .from('products')
  .update({ available_quantity: 0 })
  .eq('id', productId)
  .eq('tenant_id', tenantId);

// Product will automatically disappear from menus
```

### Regenerate Barcode
```typescript
import { generateAndStoreBarcode } from '@/lib/utils/barcodeStorage';

const newBarcodeUrl = await generateAndStoreBarcode(sku, tenantId);

await supabase
  .from('products')
  .update({ barcode_image_url: newBarcodeUrl })
  .eq('id', productId)
  .eq('tenant_id', tenantId);
```

### Force Menu Sync
```typescript
import { syncProductToMenus } from '@/lib/utils/menuSync';

// Sync to all active menus
await syncProductToMenus(productId, tenantId);

// Sync to specific menus
await syncProductToMenus(productId, tenantId, [menuId1, menuId2]);
```

## 🐛 Troubleshooting

### SKU Not Generated
**Check:**
1. Database function exists: `SELECT * FROM pg_proc WHERE proname = 'generate_product_sku';`
2. Sequence table exists: `SELECT * FROM product_sku_sequences;`
3. RLS policies allow access

### Barcode Not Generated
**Check:**
1. Edge Function deployed: Check Supabase Dashboard
2. Storage bucket exists: Check Storage → Buckets
3. Edge Function logs: Check for errors
4. barcodeapi.org accessible: Test API directly

### Product Not in Menu
**Check:**
1. `menu_visibility` column: `SELECT menu_visibility FROM products WHERE id = '...';`
2. `available_quantity` > 0: `SELECT available_quantity FROM products WHERE id = '...';`
3. Trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_menu_visibility';`
4. Menu exists: `SELECT * FROM disposable_menus WHERE tenant_id = '...';`

### Label Not Printing
**Check:**
1. Product has SKU: `SELECT sku FROM products WHERE id = '...';`
2. Browser console for errors
3. jspdf package installed: `npm list jspdf`
4. Barcode image URL accessible (CORS)

## 📊 Database Functions

### Generate SKU
```sql
SELECT generate_product_sku('flower', 'tenant-id');
-- Returns: "FLOW-0001"
```

### Get Category Prefix
```sql
SELECT get_category_prefix('flower');
-- Returns: "FLOW"
```

## 🔐 Security Notes

- All queries filter by `tenant_id` for isolation
- Edge Functions validate JWT tokens
- Storage bucket has RLS policies
- Database functions use `SECURITY DEFINER` with `SET search_path = public`

## 📚 Full Documentation

- **Implementation Guide**: `docs/PRODUCT_BARCODE_MENU_SYNC_IMPLEMENTATION.md`
- **Deployment Guide**: `docs/DEPLOYMENT_CHECKLIST_PRODUCT_SYNC.md`
- **Summary**: `docs/PRODUCT_BARCODE_MENU_SYNC_SUMMARY.md`

