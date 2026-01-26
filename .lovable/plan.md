

# Complete Storefront Full-Screen Mode Implementation Plan

## Current State

The full-screen mode for the Storefront Builder has been **planned but NOT implemented**. All the supporting infrastructure files are missing from the codebase - only the specification exists in the planning document.

### Missing Components (Must Create)

| File | Purpose |
|------|---------|
| `src/pages/admin/storefront/StorefrontDesignPage.tsx` | Entry point with full-screen toggle |
| `src/components/admin/storefront/EditorEntryCard.tsx` | Prompt card to open full-screen |
| `src/components/admin/storefront/FullScreenEditorPortal.tsx` | Portal wrapper with animations |
| `src/components/admin/storefront/UnsavedChangesDialog.tsx` | Exit confirmation dialog |
| `src/hooks/useFullScreenEditor.ts` | Full-screen state management hook |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/storefront/StorefrontBuilder.tsx` | Add `isFullScreen`, `onRequestClose`, `onDirtyChange` props |
| `src/pages/admin/hubs/StorefrontHubPage.tsx` | Import `StorefrontDesignPage` instead of `StorefrontBuilder` for Design tab |

---

## Implementation Steps

### Step 1: Create `useFullScreenEditor.ts` Hook

Create the state management hook that handles:
- Full-screen toggle state
- ESC key handling for exit
- Body scroll locking when active
- Unsaved changes dialog triggering
- Save-and-exit flow

```text
Location: src/hooks/useFullScreenEditor.ts
Exports: useFullScreenEditor({ onSave, hasUnsavedChanges })
Returns: { isFullScreen, showExitDialog, isExiting, openFullScreen, requestClose, confirmDiscard, confirmSaveAndExit, cancelExit }
```

### Step 2: Create `FullScreenEditorPortal.tsx`

Create a portal component that:
- Renders children at `document.body` level using `createPortal`
- Escapes all parent layout constraints (sidebar, admin nav)
- Uses `framer-motion` for smooth fade/scale animations
- Prevents background touch scroll on mobile
- Sets `z-index: 100` to overlay everything

### Step 3: Create `EditorEntryCard.tsx`

Create the welcoming prompt card that:
- Shows centered on the page when user navigates to Design tab
- Displays store name, last edited time, published/draft status
- Features list: Drag & Drop, Live Preview, Theme Presets, Full Screen
- Primary CTA: "Open Full-Screen Editor"
- Secondary link: "or continue in compact mode →"
- Shows ESC hint at bottom

### Step 4: Create `UnsavedChangesDialog.tsx`

Create the exit confirmation dialog:
- Uses AlertDialog from shadcn/ui
- Three buttons: "Keep Editing", "Discard Changes", "Save Draft & Exit"
- Shows loading state during save
- Only appears when `hasUnsavedChanges` is true

### Step 5: Create `StorefrontDesignPage.tsx`

Create the orchestrator entry point that:
- Fetches storefront data from `marketplace_stores`
- Uses `useFullScreenEditor` hook for state management
- Renders `EditorEntryCard` when not in full-screen
- Wraps `StorefrontBuilder` in `FullScreenEditorPortal` when full-screen
- Tracks dirty state via `onDirtyChange` callback
- Shows `UnsavedChangesDialog` on exit with unsaved changes

### Step 6: Update `StorefrontBuilder.tsx`

Modify the existing builder to accept new props:

```typescript
interface StorefrontBuilderProps {
  isFullScreen?: boolean;
  onRequestClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}
```

Changes needed:
- Accept and use `isFullScreen` prop to conditionally render close button in header
- Call `onRequestClose` when close button clicked
- Track layout/theme changes and call `onDirtyChange(true)` when modified
- Call `onDirtyChange(false)` after successful save

### Step 7: Update `StorefrontHubPage.tsx`

Change the Design tab to use the new entry page:

```typescript
// Before (line 39)
const StorefrontBuilder = lazy(() => import('@/pages/admin/storefront/StorefrontBuilder'));

// After
const StorefrontDesignPage = lazy(() => 
  import('@/pages/admin/storefront/StorefrontDesignPage').then(m => ({ default: m.StorefrontDesignPage }))
);

// And update line 151 to use StorefrontDesignPage
```

---

## Technical Details

### Z-Index Hierarchy
```text
z-40  → Admin sidebar
z-50  → Admin header
z-60  → Dropdowns
z-70  → Modals
z-80  → Toasts
z-100 → Full-screen editor (highest)
```

### State Flow
```text
1. User lands on Design tab
2. StorefrontDesignPage renders EditorEntryCard
3. User clicks "Open Full-Screen Editor"
4. openFullScreen() → isFullScreen = true
5. FullScreenEditorPortal renders at document.body
6. StorefrontBuilder renders inside portal
7. User edits → onDirtyChange(true)
8. User presses ESC or clicks close
9. requestClose() → checks hasUnsavedChanges
10a. If no changes → exits immediately
10b. If changes → shows UnsavedChangesDialog
11. User chooses action → save/discard/cancel
```

### Accessibility
- Focus trap inside portal
- ESC key to close
- Announce "Editor opened/closed" to screen readers
- Proper ARIA labels on all buttons

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `src/hooks/useFullScreenEditor.ts` |
| CREATE | `src/components/admin/storefront/FullScreenEditorPortal.tsx` |
| CREATE | `src/components/admin/storefront/EditorEntryCard.tsx` |
| CREATE | `src/components/admin/storefront/UnsavedChangesDialog.tsx` |
| CREATE | `src/pages/admin/storefront/StorefrontDesignPage.tsx` |
| MODIFY | `src/pages/admin/storefront/StorefrontBuilder.tsx` |
| MODIFY | `src/pages/admin/hubs/StorefrontHubPage.tsx` |

---

## Expected Result

After implementation:
1. Navigate to Admin → Storefront Hub → Design tab
2. See centered "Design Your Storefront" card with feature highlights
3. Click "Open Full-Screen Editor" 
4. Builder expands to 100% viewport, sidebar hidden behind
5. Make edits with full screen real estate
6. Press ESC → if unsaved changes, dialog appears
7. Choose Save Draft & Exit → saves and returns to card view
8. Sidebar visible again, admin panel restored

