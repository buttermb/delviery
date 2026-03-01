import { Outlet, useLocation, useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { RouteErrorBoundary } from "@/components/admin/RouteErrorBoundary";
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
import { OptimizedSidebar } from "@/components/sidebar/OptimizedSidebar";
import { LiveBadgeProvider } from "@/components/admin/sidebar/LiveBadgeContext";
import { useSidebarMode } from "@/hooks/useSidebarMode";
import { SidebarErrorBoundary } from "@/components/admin/sidebar/SidebarErrorBoundary";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { AccountSwitcher } from "@/components/admin/AccountSwitcher";
import { Search, Keyboard } from "lucide-react";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { InstallPWA } from "@/components/InstallPWA";
import { Suspense } from "react";
import { LoadingFallback } from "@/components/LoadingFallback";
import { useEventNotifications } from "@/hooks/useEventNotifications";
import { useEventToasts } from "@/hooks/useEventToasts";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import { initBrowserNotifications } from "@/utils/browserNotifications";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { AdminKeyboardShortcutsDialog } from "@/components/admin/AdminKeyboardShortcutsDialog";
import { useCommandPaletteStore } from "@/components/tenant-admin/CommandPalette";
import { TenantAdminCommandPalette } from "@/components/tenant-admin/CommandPalette";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { logRouteState } from "@/utils/routeDebugger";
import { useEffect } from "react";
import { QuickActionsButton } from "@/components/QuickActionsButton";
import { LowCreditWarning } from "@/components/credits/LowCreditWarning";
import { CreditToastContainer } from "@/components/credits/CreditDeductionToast";
import { SubscriptionStatusBadge } from "@/components/credits/SubscriptionStatusBadge";
import { useCredits } from "@/contexts/CreditContext";
import { CreditPurchaseModal } from "@/components/credits/CreditPurchaseModal";
import { CreditBalance } from '@/components/credits/CreditBalance';
import { OfflineStatusIndicator } from '@/components/offline/OfflineStatus';
import { InventorySyncIndicator } from '@/components/admin/storefront/InventorySyncIndicator';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useMenuOrderNotifications } from '@/hooks/useMenuOrderNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { initEventBusInvalidationBridge } from '@/lib/eventBusInvalidationBridge';
/** Closes the mobile sidebar on route change */
function MobileSidebarCloser() {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  return null;
}

/** Scrolls the admin main content area to top on route change */
function ScrollMainToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

/**
 * Admin Layout Component - v2.1.1
 * Provides the main layout structure for all admin pages
 * Updated: 2025-10-31
 */
const AdminLayout = () => {
  const location = useLocation();
  const { setOpen } = useCommandPaletteStore();
  const {
    credits,
    showLowCreditWarning,
    dismissLowCreditWarning,
    isPurchaseModalOpen,
    setIsPurchaseModalOpen
  } = useCredits();

  // Get tenant context for realtime sync
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const isOrdersSurface = location.pathname.includes('/orders') || location.pathname.includes('/storefront');
  const isOpsSurface = location.pathname.includes('/fulfillment') || location.pathname.includes('/delivery');

  // Enable real-time cross-panel data synchronization
  useRealtimeSync({
    tenantId: tenant?.id,
    enabled: !!tenant?.id,
  });

  // Bridge eventBus events to query invalidation system
  useEffect(() => {
    if (!tenant?.id) return;
    return initEventBusInvalidationBridge(queryClient, tenant.id);
  }, [queryClient, tenant?.id]);

  // Enable keyboard shortcuts
  const { shortcutsVisible, setShortcutsVisible } = useAdminKeyboardShortcuts();

  // Sidebar mode toggle (Classic vs Optimized)
  const { isOptimized } = useSidebarMode();

  // Enable real-time event notifications for orders and stock alerts
  useEventNotifications({
    enabled: isOrdersSurface || isOpsSurface,
    playSound: true,
    showBrowserNotification: true,
  });

  // Enable cross-panel toast notifications (separate from above)
  useEventToasts({ enabled: !!tenant?.id && (isOrdersSurface || isOpsSurface) });

  // Enable menu order notifications to admin (sound + push)
  useMenuOrderNotifications({ enabled: !!tenant?.id && isOrdersSurface });

  // Initialize browser push notifications on first admin load
  useEffect(() => {
    if (!(isOrdersSurface || isOpsSurface)) return;
    initBrowserNotifications();
  }, [isOrdersSurface, isOpsSurface]);

  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Log route changes only in development (not on every render)
  useEffect(() => {
    if (tenantSlug && import.meta.env.DEV) {
      logRouteState(tenantSlug, location.pathname);
    }
  }, [tenantSlug, location.pathname]);

  // Breadcrumbs are now handled by the Breadcrumbs component
  // Get current page label for mobile title display
  const getCurrentPageLabel = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const startIndex = tenantSlug && paths[0] === tenantSlug ? 1 : 0;
    const relevantPaths = paths.slice(startIndex).filter(path => path !== 'admin');
    const lastPath = relevantPaths[relevantPaths.length - 1];
    if (!lastPath) return 'Dashboard';
    return lastPath
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <TutorialProvider>
        {/* Impersonation Banner */}
        <div className="print:hidden">
        <ImpersonationBanner />

        {/* Low Credit Warning */}
        <LowCreditWarning
          open={showLowCreditWarning}
          onOpenChange={(open) => !open && dismissLowCreditWarning()}
          onBuyCredits={() => {
            dismissLowCreditWarning();
            setIsPurchaseModalOpen(true);
          }}
          currentBalance={credits}
        />

        {/* Purchase Modal */}
        <CreditPurchaseModal
          open={isPurchaseModalOpen}
          onOpenChange={setIsPurchaseModalOpen}
        />
        </div>

        {/* Command Palette */}
        <TenantAdminCommandPalette />

        {/* Unified Layout with Sidebar (Optimized or Classic) */}
        <SidebarProvider>
          <MobileSidebarCloser />
          <ScrollMainToTop />
          <div className="min-h-dvh flex w-full premium-gradient-mesh">
            <SidebarErrorBoundary>
              <LiveBadgeProvider>
                {isOptimized ? (
                  <OptimizedSidebar userTier="PROFESSIONAL" />
                ) : (
                  <AdaptiveSidebar collapsible="icon" />
                )}
              </LiveBadgeProvider>
            </SidebarErrorBoundary>
            <BreadcrumbProvider>
            <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
              <div className="print:hidden">
                <AccountSwitcher />
              </div>
              <header className="glass-floating h-14 sm:h-14 flex items-center px-4 sm:px-6 gap-2 sm:gap-4 flex-shrink-0 pt-safe safe-area-top transition-all duration-200 print:hidden">
                {/* Sidebar trigger - 48px minimum touch target */}
                <SidebarTrigger className="h-12 w-12 min-h-[48px] min-w-[48px] touch-manipulation active:scale-95 transition-transform z-dropdown -ml-1 sm:ml-0 flex items-center justify-center" />

                {/* Breadcrumbs - hidden on mobile */}
                <div className="hidden md:flex overflow-x-auto scrollbar-hide mr-4">
                  <Breadcrumbs />
                </div>

                {/* Mobile page title - show current page on mobile */}
                <div className="md:hidden flex-1 min-w-0">
                  <span className="font-semibold text-sm truncate block">
                    {getCurrentPageLabel()}
                  </span>
                </div>

                {/* Search Trigger Bar (Desktop) */}
                <div className="hidden md:flex flex-1 max-w-md ml-auto mr-2">
                  <div
                    onClick={() => setOpen(true)}
                    className="relative w-full cursor-pointer group"
                  >
                    <div className="flex items-center h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Type <kbd className="font-mono text-xs">/</kbd> to search...</span>
                      <kbd className="pointer-events-none absolute right-2 top-[50%] -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                      </kbd>
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1 sm:gap-2 ml-auto flex-shrink-0">

                  {/* Credit Balance Display */}
                  <div className="hidden sm:block">
                    <CreditBalance />
                  </div>

                  {/* Mobile Search Icon */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-10 w-10 min-h-[44px] min-w-[44px]"
                    onClick={() => setOpen(true)}
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* Subscription Status Badge - shows free tier vs paid */}
                  <div className="hidden sm:block">
                    <SubscriptionStatusBadge variant="default" />
                  </div>
                  <div className="sm:hidden">
                    <SubscriptionStatusBadge variant="compact" />
                  </div>

                  {/* Keyboard shortcuts - hidden on mobile */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center"
                          onClick={() => setShortcutsVisible(true)}
                          aria-label="Keyboard shortcuts"
                        >
                          <Keyboard className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Keyboard Shortcuts (? or click)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <AdminKeyboardShortcutsDialog
                    open={shortcutsVisible}
                    onOpenChange={setShortcutsVisible}
                  />

                  {/* Notifications - optimized touch target */}
                  <div className="[&>button]:h-10 [&>button]:w-10 [&>button]:min-h-[44px] [&>button]:min-w-[44px]">
                    <AdminNotificationCenter />
                  </div>

                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* Inventory Sync Indicator */}
                  <div className="hidden sm:block">
                    <InventorySyncIndicator size="sm" showDetails={true} />
                  </div>

                  {/* Offline Status Indicator */}
                  <div className="hidden sm:block">
                    <OfflineStatusIndicator />
                  </div>
                </div>
              </header>
              <main
                id="main-content"
                tabIndex={-1}
                className="custom-mobile-padding flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 pb-24 lg:pb-6 focus:outline-none"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  minHeight: 0,
                }}
              >
                <div className="max-w-[1920px] mx-auto w-full">
                  <RouteErrorBoundary routePath={location.pathname}>
                    <Suspense fallback={<LoadingFallback />}>
                      <Outlet />
                    </Suspense>
                  </RouteErrorBoundary>
                </div>
              </main>
            </div>
            </BreadcrumbProvider>
          </div>
        </SidebarProvider>

        {/* Mobile bottom navigation */}
        <div className="print:hidden">
          <MobileBottomNav />
        </div>

        {/* Quick Actions FAB - hidden on mobile (use bottom nav) */}
        <div className="hidden lg:block print:hidden">
          <QuickActionsButton />
        </div>

        {/* PWA install */}
        <div className="print:hidden">
          <InstallPWA />
        </div>

        {/* Credit deduction toasts */}
        <div className="print:hidden">
          <CreditToastContainer />
        </div>
      </TutorialProvider>
  );
};

export { AdminLayout };
