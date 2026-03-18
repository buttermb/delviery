# Product + Barcode + Menu Auto-Sync MVP Implementation

## Overview

This document describes the complete implementation of the Product + Barcode + Menu Auto-Sync MVP system. When a product is created, the system automatically:

1. Generates a unique SKU with category prefix + counter
2. Generates a barcode image and stores it in Supabase Storage
3. Syncs the product to disposable menus (if stock > 0)
4. Provides printable PDF label generation
5. Auto-hides products from menus when stock reaches 0

## Architecture

### Database Schema

**New Columns:**
- `products.barcode_image_url` (TEXT) - URL to barcode image in Supabase Storage
- `products.menu_visibility` (BOOLEAN) - Auto-updated based on stock levels

**New Table:**
- `product_sku_sequences` - Tracks SKU counters per category per tenant
  - Composite primary key: `(category, tenant_id)`
  - Columns: `category`, `tenant_id`, `last_number`, `prefix`, `updated_at`

**Database Functions:**
- `generate_product_sku(category, tenant_id)` - Generates unique SKU
- `get_category_prefix(category)` - Returns prefix for category
- `update_menu_visibility()` - Trigger function for auto-updating menu visibility
- `set_menu_visibility_on_insert()` - Sets initial menu visibility

**Database Triggers:**
- `trigger_update_menu_visibility` - Updates menu visibility when stock changes
- `trigger_set_menu_visibility_on_insert` - Sets initial visibility for new products

### Edge Functions

1. **`generate-product-barcode`**
   - Generates barcode image using barcodeapi.org API
   - Falls back to SVG generation if API fails
   - Uploads to Supabase Storage bucket `product-barcodes`
   - Returns public URL to barcode image
   - Requires JWT authentication

2. **`sync-product-to-menu`**
   - Syncs product to disposable menus
   - If `menu_ids` provided, syncs to specific menus
   - Otherwise, syncs to all active menus for tenant
   - Removes product from menus if stock = 0 or `menu_visibility = false`
   - Requires JWT authentication

### Client-Side Utilities

1. **`src/lib/utils/skuGenerator.ts`**
   - `generateProductSKU(category, tenantId)` - Calls database function
   - `getCategoryPrefix(category)` - Returns prefix mapping
   - `validateSKU(sku)` - Validates SKU format

2. **`src/lib/utils/barcodeStorage.ts`**
   - `generateAndStoreBarcode(sku, tenantId)` - Calls Edge Function
   - `getBarcodeUrl(tenantId, sku)` - Gets public URL
   - `deleteBarcode(tenantId, sku)` - Deletes barcode from storage

3. **`src/lib/utils/menuSync.ts`**
   - `syncProductToMenus(productId, tenantId, menuIds?)` - Calls Edge Function
   - `shouldProductBeInMenus(availableQuantity, menuVisibility)` - Helper function

4. **`src/lib/utils/labelGenerator.ts`**
   - `generateProductLabelPDF(data)` - Generates PDF blob
   - `downloadProductLabel(data)` - Downloads PDF
   - Label size: 4" x 2" (standard product label)

### UI Components

1. **`src/components/admin/ProductLabel.tsx`**
   - Preview dialog for product labels
   - Download PDF button
   - Print button (opens print dialog)
   - Shows product name, strain, type, barcode, and SKU

2. **Updated Components:**
   - `ProductManagement.tsx` - Integrated auto-SKU, barcode, menu sync
   - `ProductCard.tsx` - Added "Print Label" option
   - `EnhancedProductTable.tsx` - Added "Print Label" option

## SKU Generation

### Category Prefixes

- `flower` → `FLOW`
- `vapes` → `VAPE`
- `edibles` → `EDIB`
- `concentrates` → `CONC`
- Other categories → `PRD`

### SKU Format

Format: `PREFIX-####` (e.g., `FLOW-0093`)

- Prefix: 2-4 letters based on category
- Number: 4-digit zero-padded sequential number
- Tenant-specific: Each tenant has separate sequences per category

## Barcode Generation

### Storage Structure

```
product-barcodes/
  {tenant_id}/
    barcodes/
      {sku}.png
```

### Barcode Format

- Type: Code128
- Generated via: barcodeapi.org API (free tier)
- Fallback: SVG generation if API fails
- Storage: Supabase Storage (public bucket)

## Menu Auto-Sync

### Behavior

1. **Product Creation:**
   - If `available_quantity > 0` → Auto-syncs to all active menus
   - If `available_quantity = 0` → Not added to menus

2. **Product Update:**
   - Stock increases from 0 to > 0 → Added to menus
   - Stock decreases to 0 → Removed from menus
   - Trigger automatically updates `menu_visibility`

3. **Manual Sync:**
   - Can be triggered via Edge Function for specific menus

## Label Generation

### Label Specifications

- Size: 4" x 2" (standard product label)
- Format: PDF
- Content:
  - Product name (large, bold)
  - Strain name (if available)
  - Strain type with color coding:
    - Indica: Red
    - Sativa: Blue
    - Hybrid: Purple
  - Barcode image (centered)
  - SKU number (bottom)

### Printing

- Label-only printing (not full page)
- Download as PDF
- Print dialog opens in new window

## Storage Bucket Configuration

### Required Setup

1. **Bucket Name:** `product-barcodes`
2. **Public:** `true` (barcodes need public access)
3. **File Size Limit:** 1MB
4. **Allowed MIME Types:** `image/svg+xml`, `image/png`

### RLS Policies

The Edge Function creates the bucket automatically. RLS policies should be configured via Supabase Dashboard:

1. **Public Read:** Allow public SELECT on `product-barcodes` bucket
2. **Tenant Upload:** Allow authenticated users to INSERT only in their tenant folder
3. **Tenant Management:** Allow authenticated users to UPDATE/DELETE only in their tenant folder

## Migration Files

1. `20250210113916_product_barcode_menu_sync.sql` - Schema updates
2. `20250210113917_generate_product_sku.sql` - SKU generation functions
3. `20250210113918_menu_visibility_trigger.sql` - Menu visibility triggers
4. `20250210113919_storage_bucket_setup.sql` - Storage documentation

## Testing Checklist

- [ ] Create product without SKU → SKU auto-generated
- [ ] Create product with SKU → Uses provided SKU
- [ ] Create product → Barcode image generated and stored
- [ ] Create product with stock > 0 → Appears in menus
- [ ] Create product with stock = 0 → Hidden from menus
- [ ] Update stock from 0 to > 0 → Appears in menus
- [ ] Update stock from > 0 to 0 → Disappears from menus
- [ ] Generate label PDF → Downloads correctly
- [ ] Print label → Only label prints (not full page)
- [ ] Multiple products same category → Unique SKUs
- [ ] Concurrent product creation → No SKU conflicts
- [ ] Tenant isolation → SKUs are tenant-specific

## Error Handling

All operations include comprehensive error handling:

- SKU generation failure → Falls back to timestamp-based SKU
- Barcode generation failure → Product still created (barcode nullable)
- Storage upload failure → Logged, product creation continues
- Menu sync failure → Logged, product creation succeeds
- Label generation failure → Error toast shown

## Performance Considerations

- SKU sequences use database-level locking for concurrency
- Barcode images cached in Supabase Storage
- Menu sync happens asynchronously (non-blocking)
- Label generation is client-side (no server load)

## Future Enhancements

1. QR codes linking to product details
2. Batch tracking system integration
3. POS integration (scan barcode to decrement stock)
4. Multi-store sync
5. AI strain labeling
6. Custom label templates
7. Bulk label printing

## Files Created/Modified

### New Files
- `supabase/migrations/20250210113916_product_barcode_menu_sync.sql`
- `supabase/migrations/20250210113917_generate_product_sku.sql`
- `supabase/migrations/20250210113918_menu_visibility_trigger.sql`
- `supabase/migrations/20250210113919_storage_bucket_setup.sql`
- `supabase/functions/generate-product-barcode/index.ts`
- `supabase/functions/sync-product-to-menu/index.ts`
- `src/lib/utils/skuGenerator.ts`
- `src/lib/utils/barcodeStorage.ts`
- `src/lib/utils/menuSync.ts`
- `src/lib/utils/labelGenerator.ts`
- `src/components/admin/ProductLabel.tsx`

### Modified Files
- `src/pages/admin/ProductManagement.tsx`
- `src/components/admin/ProductCard.tsx`
- `src/components/admin/EnhancedProductTable.tsx`
- `supabase/config.toml`

## Compliance

All code follows established rules:
- ✅ Logger usage (no console.log)
- ✅ Error handling with proper types
- ✅ Tenant isolation
- ✅ TypeScript types
- ✅ Edge Function validation (Zod)
- ✅ CORS handling
- ✅ Shared dependencies

