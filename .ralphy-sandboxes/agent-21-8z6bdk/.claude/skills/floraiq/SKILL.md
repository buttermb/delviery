---
name: floraiq-conventions
description: Apply FloraIQ project conventions when writing code, creating migrations, designing UI, or working with the storefront. Use when implementing features, reviewing code, or discussing architecture for this cannabis distribution platform.
---

# FloraIQ Project Conventions

## Project Overview
FloraIQ is a multi-tenant B2B cannabis distribution platform with:
- **Admin Panel**: Business management hub at `/:tenantSlug/admin/*`
- **Storefront**: Customer-facing marketplace at `/shop/:storeSlug/*`
- **Marketing Site**: Public pages at `/`, `/features/*`, `/pricing`, etc.

---

## Supabase Conventions

### RPC Naming
- Prefix marketplace RPCs with `get_marketplace_*` or verb-based names like `create_marketplace_order`
- Use `p_` prefix for parameters: `p_store_id`, `p_email`, `p_items`
- Always use `SECURITY DEFINER` with explicit `GRANT EXECUTE` to `anon, authenticated`

### Table Patterns
```sql
-- Standard table structure
CREATE TABLE IF NOT EXISTS public.marketplace_* (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Always enable RLS
ALTER TABLE public.marketplace_* ENABLE ROW LEVEL SECURITY;
```

### Migration File Naming
Format: `YYYYMMDDHHMMSS_descriptive_snake_case.sql`
Example: `20260112000003_magic_code_rpcs.sql`

---

## Frontend Conventions

### Component Structure
- **Storefront components**: `src/components/shop/*`
- **Admin components**: `src/components/admin/*`
- **Shared UI**: `src/components/ui/*` (shadcn/ui)

### Luxury Theme System
Use the `useLuxuryTheme` hook for storefront pages:
```tsx
const { isLuxuryTheme, accentColor, cardBg, cardBorder, textMuted } = useLuxuryTheme();
// Use store.primary_color for dynamic accent
```

### Design Tokens (Luxury Theme)
- **Border Radius**: `rounded-2xl` for cards, `rounded-full` for buttons
- **Shadows**: `shadow-lg` for elevated elements, `hover:shadow-xl` for interactivity
- **Empty States**: Use dashed borders with neutral-200, centered icons, and clear CTAs
- **Typography**: `font-extrabold` for headings, `neutral-900` for text, `neutral-500` for muted

### Button Styling
```tsx
<Button 
  className="rounded-full px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
  style={{ backgroundColor: store.primary_color }}
>
  CTA Text
</Button>
```

### Formatting Utilities
- Currency: `formatCurrency(amount)` from `@/lib/utils/formatCurrency`
- Dates: `formatSmartDate(date)` from `@/lib/utils/formatDate`
- Product Names: `cleanProductName(name)` from `@/utils/productName`

---

## Edge Functions

### Location
All functions in `supabase/functions/<function-name>/index.ts`

### Standard Structure
```typescript
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // ... implementation
});
```

### Deployment
```bash
npx supabase functions deploy <function-name>
```

---

## Key Tables Reference

| Table | Purpose |
|-------|---------|
| `marketplace_stores` | Store configuration, branding, settings |
| `marketplace_listings` | Products available in storefronts |
| `marketplace_orders` | Customer orders |
| `marketplace_customers` | Customer accounts per store |
| `marketplace_magic_codes` | Passwordless auth codes |
| `inventory_reservations` | Stock locks during checkout |
| `storefront_coupons` | Discount codes |

---

## Navigation Patterns
- **Admin**: Use `useNavigate()` with tenant-aware paths: `navigate(\`/${tenantSlug}/admin/...\`)`
- **Storefront**: Use store slug: `navigate(\`/shop/${storeSlug}/...\`)`
- **Never hardcode** `/admin/` paths

---

## Testing & Verification
1. Run `npm run build` to check TypeScript errors
2. Use browser subagent for visual verification
3. Apply migrations with `npx supabase db push`
