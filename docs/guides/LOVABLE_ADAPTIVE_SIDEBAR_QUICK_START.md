# Smart Adaptive Sidebar - Lovable Quick Start

## 🚀 5-Minute Integration

### Step 1: Run Database Migrations (2 minutes)

```bash
# Apply all 3 migrations
supabase db push

# Or manually in Supabase Dashboard:
# Database → Migrations → Upload and run each file
```

**Files:**
- `supabase/migrations/20250115000000_create_sidebar_preferences.sql`
- `supabase/migrations/20250115000001_extend_feature_usage_for_sidebar.sql`
- `supabase/migrations/20250115000002_add_operation_size_detection.sql`

### Step 2: Copy All Files (2 minutes)

Copy these files to your project (maintain directory structure):

**Types:**
- `src/types/sidebar.ts`

**Configuration:**
- `src/lib/sidebar/sidebarConfigs.ts`
- `src/lib/sidebar/sidebarFilters.ts`
- `src/lib/sidebar/hotItemsLogic.ts`

**Hooks:**
- `src/hooks/useOperationSize.ts`
- `src/hooks/useSidebarPreferences.ts`
- `src/hooks/useFeatureTracking.ts`
- `src/hooks/useSidebarConfig.ts`

**Components:**
- `src/components/admin/sidebar/AdaptiveSidebar.tsx`
- `src/components/admin/sidebar/SidebarContext.tsx`
- `src/components/admin/sidebar/SidebarSection.tsx`
- `src/components/admin/sidebar/SidebarMenuItem.tsx`
- `src/components/admin/sidebar/SidebarHotItems.tsx`
- `src/components/admin/sidebar/SidebarFavorites.tsx`
- `src/components/admin/sidebar/OperationSizeSelector.tsx`

### Step 3: Update Integration Points (1 minute)

**File:** `src/pages/admin/AdminLayout.tsx`
```typescript
// Replace this:
import { TenantAdminSidebar } from "@/components/tenant-admin/TenantAdminSidebar";
<TenantAdminSidebar />

// With this:
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
<AdaptiveSidebar />
```

**File:** `src/pages/admin/SettingsPage.tsx`
```typescript
// Add import
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { Layout } from 'lucide-react';

// Add tab
<TabsTrigger value="sidebar">
  <Layout className="h-4 w-4 mr-2" />
  Sidebar
</TabsTrigger>

// Add tab content
<TabsContent value="sidebar">
  <Card className="p-6">
    <h3 className="text-lg font-semibold mb-4">Sidebar Preferences</h3>
    <OperationSizeSelector />
  </Card>
</TabsContent>
```

**File:** `src/constants/storageKeys.ts`
```typescript
// Add to STORAGE_KEYS object
SIDEBAR_OPERATION_SIZE: 'sidebar_operation_size',
SIDEBAR_FAVORITES: 'sidebar_favorites',
SIDEBAR_COLLAPSED_SECTIONS: 'sidebar_collapsed_sections',
```

### Step 4: Verify (30 seconds)

```bash
# Check for TypeScript errors
npm run build

# Check for linter errors
npm run lint

# Start dev server
npm run dev
```

### Step 5: Test

1. Log in as tenant admin
2. Check sidebar appears
3. Click ⭐ to favorite an item
4. Click section header to collapse
5. Go to Settings → Sidebar
6. Change operation size
7. Verify sidebar updates

---

## ✅ Done!

The Smart Adaptive Sidebar is now integrated and ready to use.

## 📚 Need More Details?

See `LOVABLE_ADAPTIVE_SIDEBAR_INTEGRATION_GUIDE.md` for:
- Complete architecture explanation
- Detailed code references
- Testing checklist
- Troubleshooting guide
- Flow diagrams

