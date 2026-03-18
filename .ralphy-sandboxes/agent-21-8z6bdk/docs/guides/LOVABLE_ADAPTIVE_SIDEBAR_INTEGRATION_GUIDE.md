# Smart Adaptive Sidebar - Complete Lovable Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Setup](#database-setup)
4. [File Structure](#file-structure)
5. [Step-by-Step Integration](#step-by-step-integration)
6. [Code References](#code-references)
7. [Testing Checklist](#testing-checklist)
8. [Common Issues & Solutions](#common-issues--solutions)
9. [Flow Diagrams](#flow-diagrams)
10. [Quick Reference](#quick-reference)

---

## Overview

### What is the Smart Adaptive Sidebar?

The Smart Adaptive Sidebar is a replacement for the existing `TenantAdminSidebar` that automatically adapts based on:
- **Operation Size**: Auto-detects from tenant usage metrics (Street/Small/Medium/Enterprise)
- **User Role**: Filters items based on permissions
- **Subscription Tier**: Shows/hides features based on plan
- **Feature Access**: Respects feature flags and access control
- **User Preferences**: Remembers favorites and collapsed sections
- **Business Context**: Shows contextual "hot items" (low stock, pending orders, etc.)

### Key Benefits
- **Reduced Clutter**: Street operations see 10 items, Enterprise sees 120+
- **Contextual Actions**: Hot items appear based on business state
- **Personalization**: Users can favorite items and collapse sections
- **Smart Filtering**: Automatically hides inaccessible features
- **Performance**: Optimistic updates, route prefetching, loading states

---

## Architecture

### Component Hierarchy
```
AdaptiveSidebar (Main Component)
├── SidebarContext (Provider)
│   ├── useOperationSize
│   ├── useSidebarPreferences
│   └── useFeatureTracking
├── SidebarHotItems (Contextual Actions)
├── SidebarFavorites (User Favorites)
└── SidebarSection[] (Main Sections)
    └── SidebarMenuItem[] (Individual Items)
```

### Data Flow
```
1. useSidebarConfig Hook
   ├── Gets operation size (useOperationSize)
   ├── Gets user preferences (useSidebarPreferences)
   ├── Gets role/permissions (usePermissions)
   ├── Gets feature access (useFeatureAccess)
   └── Gets tenant data (useTenantAdminAuth)

2. Applies Filters
   ├── Filter by role (sidebarFilters.ts)
   ├── Filter by tier (sidebarFilters.ts)
   └── Filter by feature access (sidebarFilters.ts)

3. Adds Contextual Data
   ├── Generate hot items (hotItemsLogic.ts)
   ├── Add favorites section
   └── Apply user preferences

4. Renders Sidebar
   ├── Hot Items Section
   ├── Favorites Section
   └── Main Sections (filtered)
```

### Database Schema

**sidebar_preferences**
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- user_id (UUID, FK → auth.users)
- operation_size (TEXT: 'street'|'small'|'medium'|'enterprise')
- custom_layout (JSONB)
- favorites (JSONB array)
- collapsed_sections (JSONB array)
- pinned_items (JSONB array)
- last_accessed_features (JSONB array)
- created_at, updated_at
```

**feature_usage_tracking**
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants)
- user_id (UUID, FK → auth.users)
- feature_id (TEXT)
- access_count (INTEGER)
- last_accessed_at (TIMESTAMPTZ)
- created_at
```

**tenants** (new column)
```sql
- detected_operation_size (TEXT: 'street'|'small'|'medium'|'enterprise')
```

---

## Database Setup

### Step 1: Run Migrations

**CRITICAL**: Run migrations in order:

```bash
# Migration 1: Create sidebar_preferences table
supabase/migrations/20250115000000_create_sidebar_preferences.sql

# Migration 2: Extend feature usage tracking
supabase/migrations/20250115000001_extend_feature_usage_for_sidebar.sql

# Migration 3: Add operation size detection
supabase/migrations/20250115000002_add_operation_size_detection.sql
```

### Step 2: Verify Database Functions

Check that these functions exist:
- `detect_operation_size(tenant_id UUID) → TEXT`
- `update_detected_operation_size(tenant_id UUID) → TEXT`
- `increment_feature_usage(tenant_id UUID, user_id UUID, feature_id TEXT) → void`

### Step 3: Verify RLS Policies

Ensure RLS is enabled and policies exist for:
- `sidebar_preferences` (SELECT, INSERT, UPDATE, DELETE)
- `feature_usage_tracking` (SELECT, INSERT, UPDATE)

**Code Reference:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('sidebar_preferences', 'feature_usage_tracking');

-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('sidebar_preferences', 'feature_usage_tracking');
```

---

## File Structure

### New Files Created

```
src/
├── types/
│   └── sidebar.ts                          # TypeScript interfaces
├── lib/
│   └── sidebar/
│       ├── sidebarConfigs.ts               # 4 tier configurations
│       ├── sidebarFilters.ts               # Filtering logic
│       └── hotItemsLogic.ts                # Hot items generation
├── hooks/
│   ├── useOperationSize.ts                 # Operation size detection
│   ├── useSidebarPreferences.ts            # User preferences
│   ├── useFeatureTracking.ts               # Usage analytics
│   └── useSidebarConfig.ts                 # Main orchestrator
└── components/
    └── admin/
        └── sidebar/
            ├── AdaptiveSidebar.tsx          # Main component
            ├── SidebarContext.tsx           # Context provider
            ├── SidebarSection.tsx           # Collapsible section
            ├── SidebarMenuItem.tsx          # Menu item
            ├── SidebarHotItems.tsx          # Hot items component
            ├── SidebarFavorites.tsx         # Favorites component
            └── OperationSizeSelector.tsx    # Settings UI

supabase/migrations/
├── 20250115000000_create_sidebar_preferences.sql
├── 20250115000001_extend_feature_usage_for_sidebar.sql
└── 20250115000002_add_operation_size_detection.sql
```

### Modified Files

```
src/
├── pages/admin/
│   ├── AdminLayout.tsx                     # Replaced TenantAdminSidebar
│   └── SettingsPage.tsx                    # Added sidebar tab
└── constants/
    └── storageKeys.ts                      # Added sidebar constants
```

---

## Step-by-Step Integration

### Phase 1: Database Setup

#### Step 1.1: Create Migrations

**File:** `supabase/migrations/20250115000000_create_sidebar_preferences.sql`

```sql
-- Create sidebar_preferences table
CREATE TABLE IF NOT EXISTS public.sidebar_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_size TEXT CHECK (operation_size IN ('street', 'small', 'medium', 'enterprise')),
  custom_layout JSONB DEFAULT '{}'::jsonb,
  favorites JSONB DEFAULT '[]'::jsonb,
  collapsed_sections JSONB DEFAULT '[]'::jsonb,
  pinned_items JSONB DEFAULT '[]'::jsonb,
  last_accessed_features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sidebar_preferences_tenant_user_unique UNIQUE (tenant_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_tenant ON public.sidebar_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sidebar_preferences_user ON public.sidebar_preferences(user_id);

-- Enable RLS
ALTER TABLE public.sidebar_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies (see migration file for full policies)
-- Policy: Users can view/insert/update/delete their own preferences
```

**File:** `supabase/migrations/20250115000001_extend_feature_usage_for_sidebar.sql`

```sql
-- Create feature_usage_tracking table
CREATE TABLE IF NOT EXISTS public.feature_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  access_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT feature_usage_tracking_unique UNIQUE (tenant_id, user_id, feature_id)
);

-- Create increment_feature_usage function
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_tenant_id UUID,
  p_user_id UUID,
  p_feature_id TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feature_usage_tracking (tenant_id, user_id, feature_id, access_count, last_accessed_at)
  VALUES (p_tenant_id, p_user_id, p_feature_id, 1, NOW())
  ON CONFLICT (tenant_id, user_id, feature_id)
  DO UPDATE SET
    access_count = feature_usage_tracking.access_count + 1,
    last_accessed_at = NOW();
END;
$$;
```

**File:** `supabase/migrations/20250115000002_add_operation_size_detection.sql`

```sql
-- Add detected_operation_size column
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS detected_operation_size TEXT CHECK (detected_operation_size IN ('street', 'small', 'medium', 'enterprise'));

-- Create detect_operation_size function
CREATE OR REPLACE FUNCTION public.detect_operation_size(tenant_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  monthly_orders_count INTEGER;
  team_count INTEGER;
  location_count INTEGER;
  usage_data JSONB;
BEGIN
  SELECT usage INTO usage_data FROM tenants WHERE id = tenant_id_param;
  
  monthly_orders_count := COALESCE((usage_data->>'customers')::INTEGER, 0);
  team_count := COALESCE((usage_data->>'users')::INTEGER, 1);
  location_count := COALESCE((usage_data->>'locations')::INTEGER, 1);

  IF monthly_orders_count < 50 AND team_count <= 2 AND location_count <= 1 THEN
    RETURN 'street';
  END IF;
  
  IF monthly_orders_count < 200 AND team_count <= 5 AND location_count <= 2 THEN
    RETURN 'small';
  END IF;
  
  IF monthly_orders_count < 1000 AND team_count <= 20 AND location_count <= 5 THEN
    RETURN 'medium';
  END IF;
  
  RETURN 'enterprise';
END;
$$;
```

#### Step 1.2: Apply Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard
# Go to Database → Migrations → Run migration files
```

#### Step 1.3: Verify Setup

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sidebar_preferences', 'feature_usage_tracking');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('detect_operation_size', 'increment_feature_usage');

-- Check column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name = 'detected_operation_size';
```

---

### Phase 2: Type Definitions

#### Step 2.1: Create Type Definitions

**File:** `src/types/sidebar.ts`

**Key Types:**
- `OperationSize` - 'street' | 'small' | 'medium' | 'enterprise'
- `SidebarItem` - Individual menu item
- `SidebarSection` - Section with items
- `SidebarPreferences` - User preferences
- `HotItem` - Contextual quick action
- `BusinessContext` - Context for hot items

**Code Reference:**
```typescript
// See src/types/sidebar.ts for complete definitions
export type OperationSize = 'street' | 'small' | 'medium' | 'enterprise';

export interface SidebarItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  hot?: boolean;
  shortcut?: string;
  permissions?: Permission[];
  minTier?: SubscriptionTier;
  featureId?: string;
}
```

---

### Phase 3: Configuration Files

#### Step 3.1: Create Sidebar Configurations

**File:** `src/lib/sidebar/sidebarConfigs.ts`

This file defines 4 complete sidebar configurations:
- `STREET_OPERATION_SIDEBAR` - 10 items
- `SMALL_BUSINESS_SIDEBAR` - 20-25 items
- `MEDIUM_BUSINESS_SIDEBAR` - 40-50 items
- `ENTERPRISE_SIDEBAR` - 120+ items

**Key Function:**
```typescript
export function getSidebarConfig(size: OperationSize): SidebarSection[] {
  switch (size) {
    case 'street': return STREET_OPERATION_SIDEBAR;
    case 'small': return SMALL_BUSINESS_SIDEBAR;
    case 'medium': return MEDIUM_BUSINESS_SIDEBAR;
    case 'enterprise': return ENTERPRISE_SIDEBAR;
    default: return MEDIUM_BUSINESS_SIDEBAR;
  }
}
```

**Important:** Each configuration uses `createItem()` helper which:
- Maps feature IDs to routes
- Sets tier requirements
- Adds icons from lucide-react
- Supports badges, shortcuts, hot flags

#### Step 3.2: Create Filtering Logic

**File:** `src/lib/sidebar/sidebarFilters.ts`

**Key Functions:**
- `filterByRole()` - Filter by user role and permissions
- `filterByPlan()` - Filter by subscription tier
- `filterByFeatureAccess()` - Filter by feature access
- `applyAllFilters()` - Apply all filters together

**Usage:**
```typescript
const filtered = applyAllFilters(sections, {
  role,
  currentTier,
  checkPermission,
  canAccessFeature: canAccess,
});
```

#### Step 3.3: Create Hot Items Logic

**File:** `src/lib/sidebar/hotItemsLogic.ts`

**Key Functions:**
- `generateHotItems(context)` - Generate contextual hot items
- `getBusinessContext(tenant)` - Extract context from tenant data

**Hot Items Triggers:**
- Low stock alerts (>5 items)
- Pending orders (>10 orders)
- Time-based (morning prep, end of day)
- Day-based (Monday weekly review)
- Action-based (recently created product)
- Credit owed alerts (>$1000)
- Fronted inventory alerts (>$5000)

---

### Phase 4: Custom Hooks

#### Step 4.1: Create useOperationSize Hook

**File:** `src/hooks/useOperationSize.ts`

**What it does:**
- Auto-detects operation size from tenant usage metrics
- Fetches manual override from `sidebar_preferences`
- Provides `setOperationSize()` to override
- Provides `resetToAuto()` to clear override

**Dependencies:**
- `useTenantAdminAuth` - Get tenant data
- `useQuery` - Fetch preferences
- `useMutation` - Update preferences

**Code Reference:**
```typescript
const {
  operationSize,      // Current size (manual or auto)
  detectedSize,       // Auto-detected size
  isAutoDetected,     // Whether using auto-detection
  setOperationSize,   // Set manual override
  resetToAuto,        // Clear override
  isLoading,
} = useOperationSize();
```

#### Step 4.2: Create useSidebarPreferences Hook

**File:** `src/hooks/useSidebarPreferences.ts`

**What it does:**
- Fetches user preferences from `sidebar_preferences` table
- Provides optimistic updates with React Query
- Manages favorites, collapsed sections, last accessed features

**Key Functions:**
- `updatePreferences()` - Update any preference
- `toggleFavorite()` - Add/remove favorite
- `toggleCollapsedSection()` - Collapse/expand section
- `trackFeatureAccess()` - Track last accessed feature

**Code Reference:**
```typescript
const {
  preferences,              // Full preferences object
  isLoading,
  updatePreferences,         // Update any preference
  toggleFavorite,            // Toggle favorite item
  toggleCollapsedSection,    // Toggle section collapse
  trackFeatureAccess,        // Track feature access
} = useSidebarPreferences();
```

#### Step 4.3: Create useFeatureTracking Hook

**File:** `src/hooks/useFeatureTracking.ts`

**What it does:**
- Tracks feature usage via `increment_feature_usage()` RPC function
- Non-blocking (errors don't break UI)
- Integrates with analytics if available

**Code Reference:**
```typescript
const { trackFeatureClick } = useFeatureTracking();

// Call when user clicks a feature
trackFeatureClick('feature-id');
```

#### Step 4.4: Create useSidebarConfig Hook

**File:** `src/hooks/useSidebarConfig.ts`

**What it does:**
- Orchestrates all sidebar logic
- Combines operation size, preferences, filters, hot items
- Returns final sidebar configuration

**Code Reference:**
```typescript
const {
  sidebarConfig,      // Final filtered config
  operationSize,      // Current operation size
  detectedSize,       // Auto-detected size
  isAutoDetected,     // Using auto-detection?
  hotItems,           // Contextual hot items
  favorites,          // User favorites
} = useSidebarConfig();
```

---

### Phase 5: React Components

#### Step 5.1: Create SidebarContext

**File:** `src/components/admin/sidebar/SidebarContext.tsx`

**What it does:**
- Provides global sidebar state to all components
- Combines all hooks into single context
- Prevents prop drilling

**Usage:**
```typescript
const { 
  operationSize, 
  setOperationSize,
  preferences,
  toggleFavorite,
  trackFeatureClick 
} = useSidebar();
```

#### Step 5.2: Create AdaptiveSidebar

**File:** `src/components/admin/sidebar/AdaptiveSidebar.tsx`

**What it does:**
- Main sidebar component
- Replaces `TenantAdminSidebar`
- Renders hot items, favorites, and main sections
- Handles upgrade modal for locked features

**Key Features:**
- Loading skeletons with Suspense
- Empty state handling
- Error boundaries
- Upgrade modal integration

**Code Reference:**
```typescript
export function AdaptiveSidebar() {
  return (
    <ContextProvider>
      <AdaptiveSidebarInner />
    </ContextProvider>
  );
}
```

#### Step 5.3: Create SidebarSection

**File:** `src/components/admin/sidebar/SidebarSection.tsx`

**What it does:**
- Collapsible section with memory
- Syncs with user preferences
- Pinned sections always expanded
- Filters items by feature access

**Code Reference:**
```typescript
<SidebarSection
  section={section}
  isActive={isActive}
  onItemClick={handleItemClick}
  onLockedItemClick={handleLockedItemClick}
/>
```

#### Step 5.4: Create SidebarMenuItem

**File:** `src/components/admin/sidebar/SidebarMenuItem.tsx`

**What it does:**
- Individual menu item
- Shows favorite star
- Tracks feature usage on click
- Prefetches route on hover
- Shows locked state for inaccessible features

**Key Features:**
- Favorite toggle button
- Badge display
- Hot item indicator
- Keyboard shortcut display
- Route prefetching

#### Step 5.5: Create SidebarHotItems

**File:** `src/components/admin/sidebar/SidebarHotItems.tsx`

**What it does:**
- Displays contextual hot items
- Filters by feature access
- Only shows if hot items exist

#### Step 5.6: Create SidebarFavorites

**File:** `src/components/admin/sidebar/SidebarFavorites.tsx`

**What it does:**
- Displays user's favorite items
- Filters favorites from all sections
- Only shows if favorites exist

#### Step 5.7: Create OperationSizeSelector

**File:** `src/components/admin/sidebar/OperationSizeSelector.tsx`

**What it does:**
- Radio group for selecting operation size
- Shows auto-detected size
- Allows manual override
- Reset to auto button

---

### Phase 6: Integration

#### Step 6.1: Replace TenantAdminSidebar

**File:** `src/pages/admin/AdminLayout.tsx`

**Before:**
```typescript
import { TenantAdminSidebar } from "@/components/tenant-admin/TenantAdminSidebar";

<TenantAdminSidebar />
```

**After:**
```typescript
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";

<AdaptiveSidebar />
```

**Code Reference:**
```12:14:src/pages/admin/AdminLayout.tsx
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
```

```92:92:src/pages/admin/AdminLayout.tsx
          <AdaptiveSidebar />
```

#### Step 6.2: Add Sidebar Settings

**File:** `src/pages/admin/SettingsPage.tsx`

**Add import:**
```typescript
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { Layout } from 'lucide-react';
```

**Add tab:**
```typescript
<TabsTrigger value="sidebar">
  <Layout className="h-4 w-4 mr-2" />
  Sidebar
</TabsTrigger>
```

**Add tab content:**
```typescript
<TabsContent value="sidebar">
  <Card className="p-6">
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      <Layout className="h-5 w-5" />
      Sidebar Preferences
    </h3>
    <div className="space-y-4">
      <OperationSizeSelector />
    </div>
  </Card>
</TabsContent>
```

**Code Reference:**
```154:157:src/pages/admin/SettingsPage.tsx
          <TabsTrigger value="sidebar">
            <Layout className="h-4 w-4 mr-2" />
            Sidebar
          </TabsTrigger>
```

```452:463:src/pages/admin/SettingsPage.tsx
        {/* Sidebar Settings */}
        <TabsContent value="sidebar">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Sidebar Preferences
            </h3>
            <div className="space-y-4">
              <OperationSizeSelector />
            </div>
          </Card>
        </TabsContent>
```

#### Step 6.3: Update Storage Keys

**File:** `src/constants/storageKeys.ts`

**Add:**
```typescript
// Sidebar Preferences (legacy - now stored in database)
SIDEBAR_OPERATION_SIZE: 'sidebar_operation_size',
SIDEBAR_CUSTOM_LAYOUT: 'sidebar_custom_layout',
SIDEBAR_FAVORITES: 'sidebar_favorites',
SIDEBAR_COLLAPSED_SECTIONS: 'sidebar_collapsed_sections',
```

---

## Code References

### Key Files and Their Purposes

#### Database Migrations

**`supabase/migrations/20250115000000_create_sidebar_preferences.sql`**
- Creates `sidebar_preferences` table
- Sets up RLS policies
- Creates update trigger

**`supabase/migrations/20250115000001_extend_feature_usage_for_sidebar.sql`**
- Creates `feature_usage_tracking` table
- Creates `increment_feature_usage()` function

**`supabase/migrations/20250115000002_add_operation_size_detection.sql`**
- Adds `detected_operation_size` column to `tenants`
- Creates `detect_operation_size()` function
- Creates `update_detected_operation_size()` function

#### Type Definitions

**`src/types/sidebar.ts`**
- `OperationSize` type
- `SidebarItem` interface
- `SidebarSection` interface
- `SidebarPreferences` interface
- `HotItem` interface
- `BusinessContext` interface

#### Configuration

**`src/lib/sidebar/sidebarConfigs.ts`**
- 4 tier configurations (STREET/SMALL/MEDIUM/ENTERPRISE)
- `getSidebarConfig()` function
- `createItem()` helper function

**`src/lib/sidebar/sidebarFilters.ts`**
- `filterByRole()` function
- `filterByPlan()` function
- `filterByFeatureAccess()` function
- `applyAllFilters()` function

**`src/lib/sidebar/hotItemsLogic.ts`**
- `generateHotItems()` function
- `getBusinessContext()` function

#### Hooks

**`src/hooks/useOperationSize.ts`**
- Auto-detects operation size
- Manages manual override
- Returns: `operationSize`, `detectedSize`, `isAutoDetected`, `setOperationSize()`, `resetToAuto()`

**`src/hooks/useSidebarPreferences.ts`**
- Fetches user preferences
- Optimistic updates
- Returns: `preferences`, `toggleFavorite()`, `toggleCollapsedSection()`, `trackFeatureAccess()`

**`src/hooks/useFeatureTracking.ts`**
- Tracks feature usage
- Returns: `trackFeatureClick()`

**`src/hooks/useSidebarConfig.ts`**
- Orchestrates all sidebar logic
- Returns: `sidebarConfig`, `operationSize`, `hotItems`, `favorites`

#### Components

**`src/components/admin/sidebar/AdaptiveSidebar.tsx`**
- Main sidebar component
- Wraps everything in `SidebarContext`
- Renders hot items, favorites, sections

**`src/components/admin/sidebar/SidebarContext.tsx`**
- Context provider
- Exports `useSidebar()` hook

**`src/components/admin/sidebar/SidebarSection.tsx`**
- Collapsible section
- Syncs with preferences
- Filters items by access

**`src/components/admin/sidebar/SidebarMenuItem.tsx`**
- Individual menu item
- Favorite toggle
- Feature tracking
- Route prefetching

**`src/components/admin/sidebar/SidebarHotItems.tsx`**
- Displays hot items section

**`src/components/admin/sidebar/SidebarFavorites.tsx`**
- Displays favorites section

**`src/components/admin/sidebar/OperationSizeSelector.tsx`**
- Settings UI for operation size

---

## Testing Checklist

### Database Tests

- [ ] **Migration 1**: `sidebar_preferences` table created
  ```sql
  SELECT * FROM sidebar_preferences LIMIT 1;
  ```

- [ ] **Migration 2**: `feature_usage_tracking` table created
  ```sql
  SELECT * FROM feature_usage_tracking LIMIT 1;
  ```

- [ ] **Migration 3**: `detected_operation_size` column exists
  ```sql
  SELECT detected_operation_size FROM tenants LIMIT 1;
  ```

- [ ] **RLS Policies**: Users can only access their own preferences
  ```sql
  -- Test as different user
  SET ROLE authenticated;
  SET request.jwt.claim.sub = 'different-user-id';
  SELECT * FROM sidebar_preferences; -- Should return empty
  ```

- [ ] **Functions**: All functions exist and work
  ```sql
  -- Test detect_operation_size
  SELECT detect_operation_size('tenant-id-here');
  
  -- Test increment_feature_usage
  SELECT increment_feature_usage('tenant-id', 'user-id', 'feature-id');
  ```

### Component Tests

- [ ] **AdaptiveSidebar Renders**
  - Sidebar appears in admin layout
  - Shows tenant name in header
  - Shows logout button in footer

- [ ] **Operation Size Detection**
  - Auto-detects correct size for test tenant
  - Shows correct number of items for each size
  - Manual override works in settings

- [ ] **Filtering Works**
  - Starter tier: Only sees starter features
  - Professional tier: Sees professional features
  - Enterprise tier: Sees all features
  - Locked items show upgrade modal

- [ ] **Hot Items Display**
  - Shows when low stock exists
  - Shows when pending orders exist
  - Time-based items appear at correct times
  - Priority sorting works (urgent > high > normal)

- [ ] **Favorites Work**
  - Click star to favorite item
  - Favorites section appears
  - Favorites persist across sessions
  - Can unfavorite items

- [ ] **Section Collapsing**
  - Click section header to collapse
  - Collapsed state persists
  - Pinned sections never collapse
  - Can expand collapsed sections

- [ ] **Feature Tracking**
  - Clicking item tracks usage
  - Usage count increments
  - Last accessed updates

- [ ] **Route Prefetching**
  - Hovering item prefetches route
  - Navigation is faster after prefetch

- [ ] **Loading States**
  - Skeleton shows while loading
  - Empty state shows when no items
  - Error handling works

### Integration Tests

- [ ] **Settings Page Integration**
  - Sidebar tab appears
  - OperationSizeSelector renders
  - Can change operation size
  - Can reset to auto-detected

- [ ] **AdminLayout Integration**
  - AdaptiveSidebar replaces TenantAdminSidebar
  - Sidebar toggles correctly
  - Breadcrumbs still work
  - Header actions still work

- [ ] **Feature Access Integration**
  - Locked items show lock icon
  - Clicking locked item shows upgrade modal
  - Upgrade modal navigates to billing

- [ ] **Multi-User Support**
  - Each user has separate preferences
  - Favorites are per-user
  - Collapsed sections are per-user

---

## Common Issues & Solutions

### Issue 1: Sidebar Not Appearing

**Symptoms:**
- Blank sidebar
- Error in console

**Solutions:**
1. Check `tenantSlug` is available in route params
2. Verify `useTenantAdminAuth()` returns tenant data
3. Check `useSidebarConfig()` returns valid config
4. Verify all hooks are properly imported

**Code Check:**
```typescript
// In AdaptiveSidebarInner
if (!tenantSlug) {
  logger.error('Missing tenantSlug');
  return null;
}
```

### Issue 2: Operation Size Not Detecting

**Symptoms:**
- Always shows "medium" size
- Manual override doesn't work

**Solutions:**
1. Check tenant `usage` JSONB has correct structure
2. Verify `detect_operation_size()` function exists
3. Check `sidebar_preferences` table has data
4. Verify RLS policies allow SELECT

**Code Check:**
```typescript
// In useOperationSize
const detectedSize = useMemo(() => {
  if (!tenant) return 'medium';
  return detectOperationSize(tenant);
}, [tenant]);
```

### Issue 3: Hot Items Not Showing

**Symptoms:**
- No hot items section
- Hot items should appear but don't

**Solutions:**
1. Check tenant data has required fields
2. Verify `getBusinessContext()` extracts data correctly
3. Check `generateHotItems()` logic
4. Verify hot items have valid feature IDs

**Code Check:**
```typescript
// In useSidebarConfig
const hotItems = useMemo((): HotItem[] => {
  if (!tenant) return [];
  const context = getBusinessContext(tenant);
  return generateHotItems(context);
}, [tenant]);
```

### Issue 4: Favorites Not Persisting

**Symptoms:**
- Favorites disappear on refresh
- Toggle doesn't work

**Solutions:**
1. Check `sidebar_preferences` table has row for user
2. Verify RLS policies allow UPDATE
3. Check `toggleFavorite()` mutation succeeds
4. Verify React Query cache is invalidated

**Code Check:**
```typescript
// In useSidebarPreferences
const toggleFavoriteMutation = useMutation({
  mutationFn: async (itemId: string) => {
    // Upsert preference
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sidebar-preferences'] });
  },
});
```

### Issue 5: Filtering Not Working

**Symptoms:**
- All items show regardless of tier
- Locked items don't show lock icon

**Solutions:**
1. Check `useFeatureAccess()` returns correct tier
2. Verify `canAccess()` function works
3. Check `applyAllFilters()` is called
4. Verify feature IDs match `featureConfig.ts`

**Code Check:**
```typescript
// In useSidebarConfig
const filteredConfig = useMemo(() => {
  return applyAllFilters(baseConfig, {
    role,
    currentTier,
    checkPermission,
    canAccessFeature: canAccess,
  });
}, [baseConfig, role, currentTier, checkPermission, canAccess]);
```

### Issue 6: TypeScript Errors

**Symptoms:**
- Type errors in sidebar files
- Icon type mismatches

**Solutions:**
1. Verify icon type is `React.ComponentType<{ className?: string }>`
2. Check all imports are correct
3. Verify `src/types/sidebar.ts` is imported
4. Ensure React is imported where needed

**Code Check:**
```typescript
// Icon type should be:
icon: React.ComponentType<{ className?: string }>

// Not:
icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
```

---

## Flow Diagrams

### User Flow: First Time User

```
1. User logs in
   ↓
2. useSidebarConfig() called
   ↓
3. useOperationSize() detects size from tenant metrics
   ↓
4. getSidebarConfig() returns config for detected size
   ↓
5. applyAllFilters() filters by role/tier/access
   ↓
6. generateHotItems() creates contextual items
   ↓
7. Sidebar renders with default preferences
   ↓
8. User interacts (favorites, collapses sections)
   ↓
9. Preferences saved to database
   ↓
10. Next visit: Preferences loaded from database
```

### User Flow: Changing Operation Size

```
1. User goes to Settings → Sidebar
   ↓
2. OperationSizeSelector shows current size
   ↓
3. User selects different size (e.g., "Enterprise")
   ↓
4. setOperationSize() called
   ↓
5. Mutation updates sidebar_preferences table
   ↓
6. React Query invalidates cache
   ↓
7. useSidebarConfig() refetches
   ↓
8. getSidebarConfig() returns new config
   ↓
9. Sidebar re-renders with new items
```

### Data Flow: Feature Click

```
1. User clicks sidebar item
   ↓
2. SidebarMenuItem.handleClick() called
   ↓
3. trackFeatureClick(featureId) called
   ↓
4. increment_feature_usage() RPC function called
   ↓
5. Database updates feature_usage_tracking
   ↓
6. trackFeatureAccess() updates last_accessed_features
   ↓
7. Navigation to route occurs
   ↓
8. Route prefetched data used (if available)
```

### Data Flow: Hot Items Generation

```
1. useSidebarConfig() gets tenant data
   ↓
2. getBusinessContext(tenant) extracts metrics
   ↓
3. generateHotItems(context) creates items
   ↓
4. Items sorted by priority (urgent > high > normal)
   ↓
5. Items filtered by feature access
   ↓
6. Hot items section rendered
```

---

## Quick Reference

### Import Statements

```typescript
// Components
import { AdaptiveSidebar } from '@/components/admin/sidebar/AdaptiveSidebar';
import { OperationSizeSelector } from '@/components/admin/sidebar/OperationSizeSelector';
import { useSidebar } from '@/components/admin/sidebar/SidebarContext';

// Hooks
import { useOperationSize } from '@/hooks/useOperationSize';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';

// Types
import type { OperationSize, SidebarItem, SidebarSection } from '@/types/sidebar';

// Config
import { getSidebarConfig } from '@/lib/sidebar/sidebarConfigs';
import { applyAllFilters } from '@/lib/sidebar/sidebarFilters';
import { generateHotItems } from '@/lib/sidebar/hotItemsLogic';
```

### Common Patterns

**Get Sidebar Config:**
```typescript
const { sidebarConfig, operationSize, hotItems } = useSidebarConfig();
```

**Track Feature Usage:**
```typescript
const { trackFeatureClick } = useFeatureTracking();
trackFeatureClick('feature-id');
```

**Toggle Favorite:**
```typescript
const { toggleFavorite } = useSidebar();
toggleFavorite('item-id');
```

**Set Operation Size:**
```typescript
const { setOperationSize, resetToAuto } = useOperationSize();
setOperationSize('enterprise');
resetToAuto();
```

### Database Queries

**Get User Preferences:**
```sql
SELECT * FROM sidebar_preferences 
WHERE tenant_id = '...' AND user_id = '...';
```

**Get Feature Usage:**
```sql
SELECT * FROM feature_usage_tracking 
WHERE tenant_id = '...' AND user_id = '...' 
ORDER BY last_accessed_at DESC;
```

**Detect Operation Size:**
```sql
SELECT detect_operation_size('tenant-id');
```

### Environment Variables

No new environment variables required. Uses existing:
- Supabase URL and keys
- Upstash Redis (for rate limiting, if enabled)
- Analytics keys (optional, for tracking)

---

## Integration Checklist

### Pre-Integration

- [ ] Review existing `TenantAdminSidebar` to understand current structure
- [ ] Verify `useFeatureAccess` hook exists and works
- [ ] Verify `usePermissions` hook exists and works
- [ ] Check `featureConfig.ts` has all feature IDs
- [ ] Verify `UpgradeModal` component exists

### Database

- [ ] Run migration 1: `create_sidebar_preferences.sql`
- [ ] Run migration 2: `extend_feature_usage_for_sidebar.sql`
- [ ] Run migration 3: `add_operation_size_detection.sql`
- [ ] Verify tables exist
- [ ] Verify functions exist
- [ ] Verify RLS policies work
- [ ] Test with sample data

### Files

- [ ] Create `src/types/sidebar.ts`
- [ ] Create `src/lib/sidebar/sidebarConfigs.ts`
- [ ] Create `src/lib/sidebar/sidebarFilters.ts`
- [ ] Create `src/lib/sidebar/hotItemsLogic.ts`
- [ ] Create `src/hooks/useOperationSize.ts`
- [ ] Create `src/hooks/useSidebarPreferences.ts`
- [ ] Create `src/hooks/useFeatureTracking.ts`
- [ ] Create `src/hooks/useSidebarConfig.ts`
- [ ] Create `src/components/admin/sidebar/AdaptiveSidebar.tsx`
- [ ] Create `src/components/admin/sidebar/SidebarContext.tsx`
- [ ] Create `src/components/admin/sidebar/SidebarSection.tsx`
- [ ] Create `src/components/admin/sidebar/SidebarMenuItem.tsx`
- [ ] Create `src/components/admin/sidebar/SidebarHotItems.tsx`
- [ ] Create `src/components/admin/sidebar/SidebarFavorites.tsx`
- [ ] Create `src/components/admin/sidebar/OperationSizeSelector.tsx`

### Integration

- [ ] Replace `TenantAdminSidebar` with `AdaptiveSidebar` in `AdminLayout.tsx`
- [ ] Add sidebar settings tab to `SettingsPage.tsx`
- [ ] Update `storageKeys.ts` with sidebar constants
- [ ] Fix `useRoutePrefetch.ts` logger import (if needed)

### Testing

- [ ] Test operation size auto-detection
- [ ] Test manual operation size override
- [ ] Test favorites functionality
- [ ] Test section collapsing
- [ ] Test hot items display
- [ ] Test feature access filtering
- [ ] Test locked items show upgrade modal
- [ ] Test route prefetching
- [ ] Test loading states
- [ ] Test error handling

### Verification

- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] Build succeeds
- [ ] Sidebar renders correctly
- [ ] All features work as expected

---

## Troubleshooting Guide

### Debug Mode

Enable debug logging in hooks:

```typescript
// In useSidebarConfig
logger.debug('Sidebar config', { 
  operationSize, 
  configLength: sidebarConfig.length,
  hotItemsCount: hotItems.length 
});
```

### Common Errors

**Error: "Cannot read property 'slug' of undefined"**
- **Cause**: `tenant` is null in `useTenantAdminAuth`
- **Fix**: Check auth context initialization

**Error: "Feature 'X' is not defined"**
- **Cause**: Feature ID doesn't exist in `featureConfig.ts`
- **Fix**: Add feature to `FEATURES` object

**Error: "RLS policy violation"**
- **Cause**: User doesn't have access to `sidebar_preferences`
- **Fix**: Check RLS policies, verify user is authenticated

**Error: "Function increment_feature_usage does not exist"**
- **Cause**: Migration 2 not run
- **Fix**: Run migration `20250115000001_extend_feature_usage_for_sidebar.sql`

---

## Performance Considerations

### Optimization Tips

1. **Memoization**: All hooks use `useMemo` for expensive computations
2. **Query Caching**: React Query caches preferences for 5 minutes
3. **Route Prefetching**: Hover prefetches routes for faster navigation
4. **Optimistic Updates**: UI updates immediately, syncs in background
5. **Lazy Loading**: Suspense boundaries for loading states

### Monitoring

Track these metrics:
- Sidebar render time
- Operation size detection time
- Preference save time
- Feature usage tracking success rate
- Hot items generation time

---

## Next Steps

After integration:

1. **Analytics**: Add tracking for sidebar usage patterns
2. **A/B Testing**: Test different sidebar configurations
3. **User Feedback**: Collect feedback on sidebar experience
4. **Performance**: Monitor and optimize slow queries
5. **Documentation**: Add user-facing help docs

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review code references in each file
3. Check database migrations were applied
4. Verify all dependencies are installed
5. Check browser console for errors
6. Review React Query DevTools for cache issues

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0
**Status:** Production Ready ✅

