

# Fix "7 features enabled · Manage" Link

## Problem
The "Manage" link in the sidebar footer points to `/admin/settings-hub?tab=features`, but:
1. The route is `/admin/settings`, not `/admin/settings-hub`
2. The SettingsHubPage has no "features" tab
3. A `FeatureTogglesPanel` component exists at `src/components/admin/settings/FeatureTogglesPanel.tsx` but is never imported or rendered anywhere

## Fix (3 files)

### 1. Add "Features" tab to SettingsHubPage
**File**: `src/pages/admin/hubs/SettingsHubPage.tsx`
- Add a `ToggleLeft` icon import from lucide-react
- Add `{ id: 'features', label: 'Features', icon: ToggleLeft, group: 'Config' }` to the tabs array
- Lazy-import the existing `FeatureTogglesPanel` from `@/components/admin/settings/FeatureTogglesPanel`
- Add a `TabsContent` for `features` that renders the panel

### 2. Fix sidebar link URL (AdaptiveSidebar)
**File**: `src/components/admin/sidebar/AdaptiveSidebar.tsx` (line 171)
- Change `settings-hub` to `settings` in the navigate call:
  `navigate(\`/\${tenantSlug}/admin/settings?tab=features\`)`

### 3. Fix sidebar link URL (Sidebar)
**File**: `src/components/admin/Sidebar.tsx` (line 268)
- Change `settings-hub?tab=features` to `settings?tab=features`

This wires the existing (but orphaned) feature toggles panel into the settings page and fixes both sidebar links to navigate there correctly.

