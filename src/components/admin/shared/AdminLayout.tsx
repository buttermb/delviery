/**
 * AdminLayout Component
 *
 * Wraps all admin pages with consistent layout including:
 * - AdminSidebar (collapsible on desktop, hamburger on mobile)
 * - Top header bar with notification bell and command palette trigger
 * - Breadcrumbs via useBreadcrumbs hook
 * - Main content area with proper spacing
 * - Responsive layout handling
 * - Layout context for nested components
 */

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { AdminSidebar } from '@/components/admin/shared/AdminSidebar';
import { PageHeader, type BreadcrumbItem, type PageBadge } from '@/components/admin/shared/PageHeader';
import { useCommandPaletteStore } from '@/components/admin/shared/CommandPalette';
import { NotificationBell } from '@/components/admin/shared/NotificationBell';
import { useSidebarBadges } from '@/hooks/useSidebarBadges';

// ============================================================================
// Layout Context
// ============================================================================

interface AdminLayoutContextValue {
  /** Whether the mobile sidebar is open */
  isMobileSidebarOpen: boolean;
  /** Toggle mobile sidebar */
  toggleMobileSidebar: () => void;
  /** Open mobile sidebar */
  openMobileSidebar: () => void;
  /** Close mobile sidebar */
  closeMobileSidebar: () => void;
  /** Whether the layout is in compact mode (for embedded views) */
  isCompact: boolean;
}

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

/**
 * Hook to access AdminLayout context
 * Must be used within an AdminLayout component
 */
export function useAdminLayout(): AdminLayoutContextValue {
  const context = useContext(AdminLayoutContext);
  if (!context) {
    throw new Error('useAdminLayout must be used within an AdminLayout');
  }
  return context;
}

// ============================================================================
// Props
// ============================================================================

export interface AdminLayoutProps {
  /** Child content to render in main area */
  children: ReactNode;
  /** Optional custom page header title (overrides PageHeader component if provided) */
  title?: string;
  /** Optional subtitle for page header */
  subtitle?: string;
  /** Optional breadcrumb items (auto-generated if not provided) */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional page badge */
  badge?: PageBadge;
  /** Optional action buttons for page header */
  actions?: ReactNode;
  /** Whether to hide the page header */
  hideHeader?: boolean;
  /** Whether to use compact mode (no sidebar, minimal padding) */
  compact?: boolean;
  /** Additional CSS classes for main content area */
  contentClassName?: string;
  /** Additional CSS classes for container */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * AdminLayout - Main layout wrapper for admin pages
 *
 * Provides:
 * - Responsive sidebar (drawer on mobile, fixed on desktop)
 * - Top header with command palette and notification bell
 * - Consistent page header with breadcrumbs
 * - Layout context for nested components
 *
 * @example
 * ```tsx
 * <AdminLayout
 *   title="Products"
 *   subtitle="Manage your product catalog"
 *   actions={<Button>Add Product</Button>}
 * >
 *   <ProductsTable />
 * </AdminLayout>
 * ```
 */
export function AdminLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions,
  hideHeader = false,
  compact = false,
  contentClassName,
  className,
}: AdminLayoutProps) {
  const { tenantSlug } = useParams();
  const { tenant } = useTenantAdminAuth();
  const { toggle: toggleCommandPalette } = useCommandPaletteStore();

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Badge counts for sidebar
  const { counts } = useSidebarBadges();

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  // ─── Guard ─────────────────────────────────────────────────────────────────

  if (!tenantSlug) {
    logger.error('AdminLayout rendered without tenantSlug', new Error('Missing tenantSlug'), {
      component: 'AdminLayout',
    });
    return null;
  }

  // ─── Layout Context ────────────────────────────────────────────────────────

  const layoutContextValue: AdminLayoutContextValue = {
    isMobileSidebarOpen,
    toggleMobileSidebar,
    openMobileSidebar,
    closeMobileSidebar,
    isCompact: compact,
  };

  // ─── Compact Mode (no sidebar) ─────────────────────────────────────────────

  if (compact) {
    return (
      <AdminLayoutContext.Provider value={layoutContextValue}>
        <div className={cn('min-h-screen bg-background', className)}>
          {!hideHeader && title && (
            <div className="p-4 border-b">
              <PageHeader
                title={title}
                subtitle={subtitle}
                breadcrumbs={breadcrumbs}
                badge={badge}
                actions={actions}
              />
            </div>
          )}
          <main className={cn('p-4', contentClassName)}>{children}</main>
        </div>
      </AdminLayoutContext.Provider>
    );
  }

  // ─── Full Layout ───────────────────────────────────────────────────────────

  return (
    <AdminLayoutContext.Provider value={layoutContextValue}>
      <div className={cn('flex min-h-screen bg-background', className)}>
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            badgeCounts={{
              pendingOrders: counts.pendingOrdersCount,
              lowStock: counts.lowStockCount,
              unreadNotifications: counts.unreadNotificationsCount,
              pendingDeliveries: counts.pendingDeliveriesCount,
            }}
            className="sticky top-0 h-screen"
          />
        </div>

        {/* Mobile Sidebar (Sheet) */}
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <AdminSidebar
              badgeCounts={{
                pendingOrders: counts.pendingOrdersCount,
                lowStock: counts.lowStockCount,
                unreadNotifications: counts.unreadNotificationsCount,
                pendingDeliveries: counts.pendingDeliveriesCount,
              }}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Left: Mobile hamburger + Tenant name */}
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={toggleMobileSidebar}
                aria-label="Toggle navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Tenant Name (visible on mobile) */}
              <div className="lg:hidden flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-white font-semibold text-sm">
                  {tenant?.slug?.charAt(0).toUpperCase() || 'T'}
                </div>
                <span className="font-medium text-sm truncate max-w-[120px]">
                  {tenant?.business_name || tenant?.slug || 'Admin'}
                </span>
              </div>
            </div>

            {/* Right: Command palette + Notification bell */}
            <div className="flex items-center gap-2">
              {/* Command Palette Trigger */}
              <Button
                variant="outline"
                className="hidden sm:flex items-center gap-2 text-muted-foreground h-9 px-3"
                onClick={toggleCommandPalette}
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Search...</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>

              {/* Mobile Search Button */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={toggleCommandPalette}
                aria-label="Open search"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Notification Bell */}
              <NotificationBell />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <div className={cn('p-4 lg:p-6', contentClassName)}>
              <div className="max-w-7xl mx-auto w-full">
                {/* Page Header */}
                {!hideHeader && title && (
                  <PageHeader
                    title={title}
                    subtitle={subtitle}
                    breadcrumbs={breadcrumbs}
                    badge={badge}
                    actions={actions}
                    className="mb-6"
                  />
                )}

                {/* Children */}
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminLayoutContext.Provider>
  );
}

export default AdminLayout;
