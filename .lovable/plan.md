

# Fix: Double Sidebar on Driver Pages + Light Mode Toggle Not Accessible

## Problems

### 1. Double Sidebar
`DriverDirectoryPage` and `DriverProfilePage` both import and wrap their content in `AdminLayout` from `src/components/admin/shared/AdminLayout.tsx`. This shared `AdminLayout` renders its own `AdminSidebar` + header. But these pages are already rendered inside the **route-level** `AdminLayout` (`src/pages/admin/AdminLayout.tsx`) via `<Outlet />`, which has its own sidebar (OptimizedSidebar or AdaptiveSidebar). Result: two sidebars stacked side by side.

No other pages in `src/pages/` use the shared `AdminLayout` — they render content directly.

### 2. Light Mode Toggle
The `ThemeToggle` component IS present in the route-level header (line 295 of `pages/admin/AdminLayout.tsx`). However, the double sidebar + double header from the shared `AdminLayout` pushes content and makes the outer header's theme toggle hard to find. Fixing the double sidebar will expose the theme toggle properly.

## Plan

### File 1: `src/pages/drivers/DriverDirectoryPage.tsx`
- Remove the `import { AdminLayout }` from shared
- Remove the `<AdminLayout>` wrapper — render the page content directly (just a `<div>` with appropriate padding/classes matching other pages)
- Keep the title/subtitle as inline elements since the route-level header already provides breadcrumbs

### File 2: `src/pages/drivers/DriverProfilePage.tsx`
- Same change: remove the shared `AdminLayout` wrapper, render content directly

Both pages will then render cleanly inside the route-level layout's `<Outlet />`, with a single sidebar and a single header (which includes the ThemeToggle).

