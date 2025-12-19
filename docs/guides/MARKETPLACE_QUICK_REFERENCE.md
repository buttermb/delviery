# Marketplace Quick Reference Guide

## 🗂️ Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `marketplace_profiles` | Seller profiles | `tenant_id`, `business_name`, `license_number`, `license_verified`, `marketplace_status` |
| `marketplace_listings` | Product listings | `tenant_id`, `marketplace_profile_id`, `product_name`, `base_price`, `images`, `status` |
| `marketplace_orders` | Wholesale orders | `buyer_tenant_id`, `seller_tenant_id`, `order_number`, `status`, `platform_fee` |
| `marketplace_order_items` | Order line items | `order_id`, `listing_id`, `quantity`, `unit_price` |
| `marketplace_cart` | Shopping cart | `buyer_tenant_id`, `listing_id`, `quantity` |
| `platform_transactions` | Fee tracking | `tenant_id`, `order_id`, `amount`, `fee_percentage` |

## 🔑 Key Field Names

### marketplace_profiles
- `business_name` (TEXT, required)
- `business_description` (TEXT, optional)
- `logo_url` (TEXT, optional)
- `cover_image_url` (TEXT, optional)
- `license_number` (TEXT, optional)
- `license_type` (TEXT, optional)
- `license_state` (TEXT, optional)
- `license_document_url` (TEXT, optional)
- `license_verified` (BOOLEAN, default: false)
- `marketplace_status` (TEXT, default: 'pending')
- `can_sell` (BOOLEAN, default: false)
- `verified_badge` (BOOLEAN, default: false)

### marketplace_listings
- `product_name` (TEXT, required)
- `product_type` (TEXT, optional)
- `strain_type` (TEXT, optional)
- `description` (TEXT, optional)
- `base_price` (NUMERIC, required)
- `bulk_pricing` (JSONB, default: [])
- `quantity_available` (NUMERIC, default: 0)
- `unit_type` (TEXT, default: 'lb')
- `images` (TEXT[], default: []) - **NOT `image_urls`**
- `status` (TEXT, default: 'draft')
- `visibility` (TEXT, default: 'public')
- `lab_results` (JSONB, optional, encrypted)
- `lab_results_encrypted` (BOOLEAN, default: true)

## 🛣️ Routes Reference

### Tenant Admin Routes
```
/:tenantSlug/admin/marketplace/profile
/:tenantSlug/admin/marketplace/profile/edit
/:tenantSlug/admin/marketplace/listings
/:tenantSlug/admin/marketplace/listings/new
/:tenantSlug/admin/marketplace/listings/:listingId
/:tenantSlug/admin/marketplace/listings/:listingId/edit
/:tenantSlug/admin/marketplace/orders
/:tenantSlug/admin/marketplace/orders/:orderId
```

### Customer Routes
```
/:tenantSlug/shop/wholesale
/:tenantSlug/shop/wholesale/cart
/:tenantSlug/shop/wholesale/checkout
/:tenantSlug/shop/wholesale/orders
/:tenantSlug/shop/wholesale/orders/:orderId
```

### Super Admin Routes
```
/super-admin/marketplace/moderation
```

## 🔧 Edge Functions

### create-marketplace-profile
**Endpoint:** `supabase.functions.invoke('create-marketplace-profile')`

**Request Body:**
```typescript
{
  tenant_id: string;
  business_name: string;
  business_description?: string;
  license_number: string;
  license_type: string;
  license_state: string;
  license_expiry_date?: string;
  license_document_url: string;
  shipping_states: string[];
  logo_url?: string;
  cover_image_url?: string;
  shipping_policy?: string;
  return_policy?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  profile: MarketplaceProfile;
}
```

### create-marketplace-order
**Endpoint:** `supabase.functions.invoke('create-marketplace-order')`

**Request Body:**
```typescript
{
  buyer_tenant_id: string;
  buyer_user_id?: string;
  seller_tenant_id: string;
  seller_profile_id: string;
  items: Array<{
    listing_id?: string;
    product_name: string;
    product_type?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  shipping_method?: string;
  shipping_cost?: number;
  tax?: number;
  payment_terms?: 'prepaid' | 'net_30' | 'net_60';
  buyer_notes?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  order: MarketplaceOrder;
  orderItems: MarketplaceOrderItem[];
  feeBreakdown: {
    subtotal: number;
    platformFee: number;
    tax: number;
    shippingCost: number;
    totalAmount: number;
  };
}
```

## 💰 Platform Fee Calculation

- **Fee Percentage:** 2% of order subtotal
- **Formula:** `platformFee = subtotal * 0.02`
- **Rounded to:** 2 decimal places
- **Charged to:** Seller (deducted from order total)
- **Tracked in:** `platform_transactions` table

## 📊 Order Status Flow

```
pending → accepted → processing → shipped → delivered
   ↓
rejected/cancelled
```

## 🔐 Security Notes

1. **RLS Policies:** All tables have Row Level Security enabled
2. **Encryption:** Lab results and sensitive financial data are encrypted
3. **License Verification:** Required before sellers can list products
4. **Multi-Tenant Isolation:** All queries filter by `tenant_id`

## 🚀 Storage Buckets Required

1. **marketplace-assets**
   - Product images
   - Profile logos
   - Banner images

2. **marketplace-documents**
   - License documents (PDF)
   - COA documents (PDF)

## 📝 Common Queries

### Get Seller Profile
```typescript
const { data } = await supabase
  .from('marketplace_profiles')
  .select('*')
  .eq('tenant_id', tenantId)
  .maybeSingle();
```

### Get Active Listings
```typescript
const { data } = await supabase
  .from('marketplace_listings')
  .select('*, marketplace_profiles(*)')
  .eq('status', 'active')
  .eq('visibility', 'public')
  .order('created_at', { ascending: false });
```

### Get Orders for Seller
```typescript
const { data } = await supabase
  .from('marketplace_orders')
  .select('*, marketplace_order_items(*)')
  .eq('seller_tenant_id', tenantId)
  .order('created_at', { ascending: false });
```

### Get Cart Items
```typescript
const { data } = await supabase
  .from('marketplace_cart')
  .select('*, marketplace_listings(*)')
  .eq('buyer_tenant_id', tenantId);
```

## ⚠️ Important Notes

1. **One Profile Per Tenant:** `marketplace_profiles` has `UNIQUE(tenant_id)` constraint
2. **Profile Required for Listings:** Listings must have a `marketplace_profile_id`
3. **License Verification:** Sellers cannot list until license is verified by super admin
4. **Multi-Seller Orders:** Checkout creates separate orders for each seller
5. **Cart Clearing:** Cart is automatically cleared after successful order creation

## 🐛 Troubleshooting

### "Profile not found" error
- Check if `marketplace_profiles` record exists for tenant
- Verify RLS policies allow access
- Check `marketplace_status` is 'active'

### "Cannot create listing" error
- Verify profile exists and `can_sell = true`
- Check `license_verified = true`
- Ensure `marketplace_status = 'active'`

### "Order creation failed" error
- Verify all required fields are provided
- Check edge function logs
- Verify cart items are valid
- Check inventory availability

### "RLS policy violation" error
- Verify user has correct tenant context
- Check RLS policies match user role
- Ensure queries filter by `tenant_id`

