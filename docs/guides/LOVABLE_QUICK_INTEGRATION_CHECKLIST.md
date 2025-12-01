# ⚡ Lovable Quick Integration Checklist

## 🚀 5-Minute Integration Check

### ✅ Pre-Integration Verification

- [ ] Database migration `20250128000000_marketplace_tables.sql` has been run
- [ ] Edge functions `create-marketplace-profile` and `create-marketplace-order` exist
- [ ] Storage buckets `product-images` and `marketplace-documents` are created
- [ ] All files from Cursor are committed to repository

### ✅ File Verification (2 minutes)

Run these commands in Lovable terminal:

```bash
# Check all new/updated files exist
ls src/pages/tenant-admin/marketplace/MessagesPage.tsx
ls src/components/admin/EnhancedProductTable.tsx
ls src/pages/admin/ProductManagement.tsx
ls src/pages/tenant-admin/DashboardPage.tsx
ls src/lib/sidebar/sidebarConfigs.ts
ls src/lib/featureConfig.ts

# Verify routes in App.tsx
grep -n "marketplace/messages" src/App.tsx
grep -n "MessagesPage" src/App.tsx
```

### ✅ Database Verification (1 minute)

Run in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'marketplace_%'
ORDER BY tablename;

-- Should return:
-- marketplace_cart
-- marketplace_listings
-- marketplace_messages
-- marketplace_order_items
-- marketplace_orders
-- marketplace_profiles
-- marketplace_reviews
-- platform_transactions

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'marketplace_%' 
AND rowsecurity = false;

-- Should return 0 rows (all have RLS enabled)
```

### ✅ Feature Config Verification (30 seconds)

Check `src/lib/featureConfig.ts`:

```typescript
// Should have this entry:
'marketplace': {
  id: 'marketplace',
  name: 'Wholesale Marketplace',
  tier: 'professional',
  // ...
}
```

### ✅ Sidebar Verification (30 seconds)

Check `src/lib/sidebar/sidebarConfigs.ts`:

```typescript
// Should have Marketplace section in MEDIUM_BUSINESS_SIDEBAR:
{
  section: '🌐 Marketplace',
  items: [
    // ... including Messages
    createItem('marketplace', 'Messages', '/admin/marketplace/messages', MessageSquare, { hot: true }),
  ],
}
```

### ✅ Build Test (1 minute)

```bash
npm run build
```

Should complete without TypeScript errors (warnings are OK).

---

## 🧪 Quick Functionality Test

### Test 1: Messages Page (30 seconds)
1. Navigate to `/admin/marketplace/messages` (as Medium+ tenant)
2. Should load without errors
3. Should show "No Messages" if empty

### Test 2: Quick-Create Listing (30 seconds)
1. Navigate to `/admin/inventory/products`
2. Click "•••" on any product
3. Should see "List on Marketplace" option
4. Click it → Should navigate to listing form with pre-filled data

### Test 3: Onboarding Checklist (30 seconds)
1. Navigate to `/admin/dashboard`
2. If onboarding incomplete, should see "Setup Progress" card
3. Should show 4 steps with progress bar

### Test 4: Sidebar Navigation (30 seconds)
1. Log in as Medium+ tier tenant
2. Check sidebar for "🌐 Marketplace" section
3. Should include "Messages" with hot badge

---

## 🐛 Common Quick Fixes

### Messages Page 404
**Fix:** Verify route exists in `App.tsx`:
```typescript
<Route path="marketplace/messages" element={...} />
```

### "List on Marketplace" Missing
**Fix:** Check subscription tier:
```typescript
// In ProductManagement.tsx
const canAccessMarketplace = 
  subscriptionPlan === 'professional' || 
  subscriptionPlan === 'enterprise' || 
  subscriptionPlan === 'medium';
```

### Sidebar Marketplace Section Missing
**Fix:** Check operation size detection and subscription tier

### TypeScript Errors
**Fix:** Verify imports:
```typescript
import { MessageSquare, Store } from 'lucide-react';
```

---

## ✅ Integration Complete When:

- [x] All files exist
- [x] Database tables created
- [x] Routes configured
- [x] Sidebar updated
- [x] Feature config updated
- [x] Build succeeds
- [x] All quick tests pass

**Total Time:** ~5 minutes

---

**Need Help?** See `LOVABLE_FULL_IMPLEMENTATION_GUIDE.md` for detailed instructions.

