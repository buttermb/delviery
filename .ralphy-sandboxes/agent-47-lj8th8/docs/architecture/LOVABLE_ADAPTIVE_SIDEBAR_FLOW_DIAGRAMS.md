# Smart Adaptive Sidebar - Flow Diagrams for Lovable

## Visual Flow Diagrams

### 1. Component Hierarchy Flow

```
App.tsx
└── AdminLayout
    └── AdaptiveSidebar
        ├── SidebarContext (Provider)
        │   ├── useOperationSize
        │   ├── useSidebarPreferences
        │   └── useFeatureTracking
        ├── SidebarHotItems
        │   └── SidebarMenuItem[] (hot items)
        ├── SidebarFavorites
        │   └── SidebarMenuItem[] (favorites)
        └── SidebarSection[]
            └── SidebarMenuItem[] (regular items)
```

### 2. Data Flow: Sidebar Rendering

```
User Login
    ↓
useSidebarConfig() Hook
    ├── useOperationSize()
    │   ├── Get tenant from useTenantAdminAuth()
    │   ├── Detect size from tenant.usage metrics
    │   └── Get manual override from sidebar_preferences
    │
    ├── useSidebarPreferences()
    │   └── Fetch from sidebar_preferences table
    │
    ├── usePermissions()
    │   └── Get role from tenant_users
    │
    ├── useFeatureAccess()
    │   └── Get tier from tenant.subscription_plan
    │
    └── useTenantAdminAuth()
        └── Get tenant data
    ↓
getSidebarConfig(operationSize)
    └── Returns config for size (STREET/SMALL/MEDIUM/ENTERPRISE)
    ↓
applyAllFilters(config, { role, tier, permissions })
    ├── filterByRole()
    ├── filterByPlan()
    └── filterByFeatureAccess()
    ↓
generateHotItems(businessContext)
    └── Creates contextual items based on tenant state
    ↓
Add Favorites Section
    └── Extract favorites from all sections
    ↓
Apply User Preferences
    ├── Collapse sections from preferences
    └── Pin sections that are pinned
    ↓
Render Sidebar
    ├── Hot Items Section
    ├── Favorites Section
    └── Main Sections (filtered)
```

### 3. User Action Flow: Favorite Item

```
User clicks ⭐ on menu item
    ↓
SidebarMenuItem.handleFavoriteClick()
    ↓
useSidebar().toggleFavorite(itemId)
    ↓
useSidebarPreferences().toggleFavoriteMutation()
    ├── Optimistic Update (UI updates immediately)
    ├── Cancel outgoing queries
    ├── Update React Query cache
    └── Call mutation function
        ↓
    Supabase: UPDATE sidebar_preferences
    SET favorites = [...favorites, itemId]
    WHERE tenant_id = ? AND user_id = ?
        ↓
    onSuccess: Invalidate queries
        ↓
    Sidebar re-renders with favorites section
```

### 4. User Action Flow: Change Operation Size

```
User goes to Settings → Sidebar
    ↓
OperationSizeSelector renders
    ├── Shows current operationSize
    ├── Shows detectedSize
    └── Shows isAutoDetected badge
    ↓
User selects "Enterprise" radio button
    ↓
handleSizeChange('enterprise')
    ↓
useOperationSize().setOperationSize('enterprise')
    ↓
setOperationSizeMutation()
    ├── Optimistic Update
    └── Supabase: UPSERT sidebar_preferences
        SET operation_size = 'enterprise'
        ↓
    onSuccess: Invalidate queries
        ↓
    useSidebarConfig() refetches
        ↓
    getSidebarConfig('enterprise') called
        ↓
    Returns ENTERPRISE_SIDEBAR (120+ items)
        ↓
    Sidebar re-renders with new items
```

### 5. Feature Click Flow

```
User clicks menu item
    ↓
SidebarMenuItem.handleClick()
    ├── trackFeatureClick(featureId)
    │   └── useFeatureTracking()
    │       └── increment_feature_usage() RPC
    │           └── Database: UPDATE feature_usage_tracking
    │               SET access_count = access_count + 1
    │
    ├── trackFeatureAccess(featureId)
    │   └── Updates last_accessed_features in preferences
    │
    └── Navigation to route
        └── Route prefetched data used (if available)
```

### 6. Hot Items Generation Flow

```
useSidebarConfig() gets tenant data
    ↓
getBusinessContext(tenant)
    ├── Extract low_stock_count
    ├── Extract pending_orders
    ├── Extract active_drivers
    ├── Extract credit_owed
    ├── Extract fronted_total
    ├── Get timeOfDay (0-23)
    └── Get dayOfWeek (0-6)
    ↓
generateHotItems(context)
    ├── IF lowStock > 5: Add "Restock Alert"
    ├── IF pendingOrders > 10: Add "Orders Waiting"
    ├── IF timeOfDay 6-12: Add "Morning Prep"
    ├── IF timeOfDay 20-23: Add "End of Day"
    ├── IF dayOfWeek === 1 AND timeOfDay >= 9: Add "Weekly Review"
    ├── IF creditOwed > 1000: Add "Credit Alert"
    └── IF frontedTotal > 5000: Add "Fronted Alert"
    ↓
Sort by priority (urgent > high > normal)
    ↓
Filter by feature access
    ↓
Return HotItem[]
    ↓
Render in SidebarHotItems component
```

### 7. Database Transaction Flow: Preference Update

```
User toggles favorite
    ↓
Frontend: Optimistic Update
    └── React Query cache updated immediately
    ↓
Backend: Database Transaction
    BEGIN;
        SELECT * FROM sidebar_preferences 
        WHERE tenant_id = ? AND user_id = ?;
        
        IF EXISTS:
            UPDATE sidebar_preferences
            SET favorites = ?, updated_at = NOW()
            WHERE tenant_id = ? AND user_id = ?;
        ELSE:
            INSERT INTO sidebar_preferences
            (tenant_id, user_id, favorites, ...)
            VALUES (?, ?, ?, ...);
    COMMIT;
    ↓
onSuccess: Invalidate React Query cache
    ↓
Frontend: Refetch preferences
    ↓
Sidebar: Re-render with updated favorites
```

### 8. Operation Size Detection Flow

```
Tenant created/updated
    ↓
Tenant.usage JSONB contains:
    {
      "customers": 150,    // Monthly orders
      "users": 3,          // Team size
      "locations": 1       // Location count
    }
    ↓
detect_operation_size(tenant_id)
    ├── Extract monthly_orders_count = 150
    ├── Extract team_count = 3
    └── Extract location_count = 1
    ↓
Classification Logic:
    IF orders < 50 AND team <= 2 AND locations <= 1:
        RETURN 'street'
    ELSE IF orders < 200 AND team <= 5 AND locations <= 2:
        RETURN 'small'  ← Matches (150 < 200, 3 <= 5, 1 <= 2)
    ELSE IF orders < 1000 AND team <= 20 AND locations <= 5:
        RETURN 'medium'
    ELSE:
        RETURN 'enterprise'
    ↓
UPDATE tenants
SET detected_operation_size = 'small'
WHERE id = tenant_id;
    ↓
Frontend: useOperationSize() reads detected_operation_size
    ↓
getSidebarConfig('small') returns SMALL_BUSINESS_SIDEBAR
    ↓
Sidebar renders with 20-25 items
```

### 9. Filtering Flow: Multi-Layer

```
Base Config (e.g., MEDIUM_BUSINESS_SIDEBAR)
    └── 40-50 items, all tiers
    ↓
Filter by Role
    ├── Check item.permissions
    ├── Check user role via usePermissions()
    └── Remove items user can't access
    └── Result: 35-45 items (some removed)
    ↓
Filter by Subscription Tier
    ├── Check item.minTier
    ├── Check tenant.subscription_plan
    ├── Check feature access via useFeatureAccess()
    └── Remove items not in tier
    └── Result: 25-35 items (more removed)
    ↓
Filter by Feature Access
    ├── Check item.featureId
    ├── Check canAccess(featureId)
    └── Remove locked features
    └── Result: 20-30 items (final)
    ↓
Apply User Preferences
    ├── Add favorites section
    ├── Collapse sections from preferences
    └── Pin sections that are pinned
    ↓
Final Sidebar Config
    └── Ready to render
```

### 10. Error Handling Flow

```
Any Hook Error
    ↓
try/catch block
    ├── Log error with logger.error()
    ├── Show user-friendly toast
    └── Return fallback/default value
    ↓
Component Error
    ↓
Error Boundary (if implemented)
    ├── Catch React errors
    ├── Show error UI
    └── Log to error tracking service
    ↓
Database Error
    ↓
RLS Policy Violation
    ├── Check user authentication
    ├── Check tenant membership
    └── Verify RLS policies
    ↓
Network Error
    ↓
React Query Retry
    ├── Retry 3 times with exponential backoff
    └── Show error state if all retries fail
```

---

## Sequence Diagrams

### Sequence: Sidebar Initialization

```
User → AdminLayout → AdaptiveSidebar
                        ↓
                    SidebarContext.Provider
                        ↓
                    useSidebarConfig()
                        ├──→ useOperationSize()
                        │       ├──→ useTenantAdminAuth()
                        │       └──→ Query: sidebar_preferences
                        │
                        ├──→ useSidebarPreferences()
                        │       └──→ Query: sidebar_preferences
                        │
                        ├──→ usePermissions()
                        │       └──→ Query: tenant_users
                        │
                        ├──→ useFeatureAccess()
                        │       └──→ Get from tenant.subscription_plan
                        │
                        └──→ getSidebarConfig()
                                └──→ applyAllFilters()
                                        └──→ generateHotItems()
                        ↓
                    Return sidebarConfig
                        ↓
                    Render Sidebar
```

### Sequence: User Favorites Item

```
User → SidebarMenuItem (clicks ⭐)
        ↓
    handleFavoriteClick()
        ↓
    useSidebar().toggleFavorite(itemId)
        ↓
    useSidebarPreferences().toggleFavoriteMutation()
        ├── Optimistic Update (React Query cache)
        ├── Cancel queries
        └── Mutation Function
            ↓
        Supabase Client
            ↓
        Database: UPSERT sidebar_preferences
            └── SET favorites = [...]
        ↓
    onSuccess: Invalidate queries
        ↓
    Refetch preferences
        ↓
    Sidebar re-renders
        ↓
    Favorites section updates
```

---

## State Management Flow

### React Query Cache Structure

```
Query Cache:
├── ['sidebar-preferences', tenantId, userId]
│   └── SidebarPreferences object
│
├── ['tenant-users', tenantId]
│   └── User role data
│
└── ['tenants', tenantId]
    └── Tenant data with detected_operation_size
```

### Context State Structure

```
SidebarContext:
├── operationSize: 'small'
├── detectedSize: 'small'
├── isAutoDetected: true
├── preferences: {
│   ├── favorites: ['dashboard', 'products']
│   ├── collapsedSections: ['Analytics']
│   └── lastAccessedFeatures: [...]
│   }
└── Functions:
    ├── setOperationSize()
    ├── toggleFavorite()
    ├── toggleCollapsedSection()
    └── trackFeatureClick()
```

---

## Integration Points

### With Existing Systems

**TenantAdminAuthContext:**
- Provides `tenant` data
- Provides `admin` (user) data
- Used by all hooks

**FeatureConfig:**
- Provides `FEATURES` object
- Provides `hasFeatureAccess()` function
- Used for filtering

**Permissions System:**
- Provides `usePermissions()` hook
- Provides `checkPermission()` function
- Used for role-based filtering

**UpgradeModal:**
- Shows when locked feature clicked
- Navigates to billing page
- Used by AdaptiveSidebar

**SettingsPage:**
- Hosts OperationSizeSelector
- Provides UI for manual override
- Uses useOperationSize hook

---

**These diagrams show the complete flow of data and user interactions in the Smart Adaptive Sidebar system.**

