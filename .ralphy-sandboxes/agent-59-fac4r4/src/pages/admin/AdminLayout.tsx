import { Outlet, useLocation, useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
import { OptimizedSidebar } from "@/components/sidebar/OptimizedSidebar";
import { LiveBadgeProvider } from "@/components/admin/sidebar/LiveBadgeContext";
import { useSidebarMode } from "@/hooks/useSidebarMode";
import { SidebarErrorBoundary } from "@/components/admin/sidebar/SidebarErrorBoundary";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { AccountSwitcher } from "@/components/admin/AccountSwitcher";
import { Search, Keyboard } from "lucide-react";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";
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
import { useIsAdminMobile } from '@/hooks/useIsAdminMobile';
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

  // Enable real-time cross-panel data synchronization
  useRealtimeSync({
    tenantId: tenant?.id,
    enabled: !!tenant?.id,
  });

  // Enable keyboard shortcuts
  const { shortcutsVisible, setShortcutsVisible } = useAdminKeyboardShortcuts();

  // Sidebar mode toggle (Classic vs Optimized)
  const { isOptimized } = useSidebarMode();

  // Use admin-specific mobile breakpoint (1024px) to match lg: CSS breakpoint
  const isAdminMobile = useIsAdminMobile();

  // Enable real-time event notifications for orders and stock alerts
  useEventNotifications({
    enabled: true,
    playSound: true,
    showBrowserNotification: true,
  });

  // Enable cross-panel toast notifications (separate from above)
  useEventToasts({ enabled: !!tenant?.id });

  // Enable menu order notifications to admin (sound + push)
  useMenuOrderNotifications({ enabled: !!tenant?.id });

  // Initialize browser push notifications on first admin load
  useEffect(() => {
    initBrowserNotifications();
  }, []);

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

        {/* Command Palette */}
        <TenantAdminCommandPalette />

        {/* Unified Layout with Sidebar (Optimized or Classic) */}
        <SidebarProvider isMobileOverride={isAdminMobile}>
          <div className="min-h-dvh flex w-full premium-gradient-mesh">
            <SidebarErrorBoundary>
              <LiveBadgeProvider>
                {isOptimized ? (
                  <OptimizedSidebar userTier="PROFESSIONAL" />
                ) : (
                  <AdaptiveSidebar />
                )}
              </LiveBadgeProvider>
            </SidebarErrorBoundary>
            <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
              <AccountSwitcher />
              <header className="glass-floating h-14 sm:h-14 flex items-center px-2 sm:px-3 md:px-4 lg:px-6 gap-2 sm:gap-3 md:gap-4 flex-shrink-0 pt-safe safe-area-top transition-all duration-200">
                {/* Sidebar trigger - 48px minimum touch target */}
                <SidebarTrigger className="h-12 w-12 min-h-[48px] min-w-[48px] touch-manipulation active:scale-95 transition-transform z-50 -ml-1 sm:ml-0 flex items-center justify-center" />

                {/* Breadcrumbs - hidden on mobile/tablet */}
                <div className="hidden lg:flex overflow-x-auto scrollbar-hide mr-4">
                  <Breadcrumbs />
                </div>

                {/* Mobile/tablet page title - show current page below lg */}
                <div className="lg:hidden flex-1 min-w-0">
                  <span className="font-semibold text-sm truncate block">
                    {getCurrentPageLabel()}
                  </span>
                </div>

                {/* Search Trigger Bar (Desktop) */}
                <div className="hidden lg:flex flex-1 max-w-md ml-auto mr-2">
                  <div
                    onClick={() => setOpen(true)}
                    className="relative w-full cursor-pointer group"
                  >
                    <div className="flex items-center h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Search...</span>
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

                  {/* Mobile/tablet Search Icon */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-10 w-10 min-h-[44px] min-w-[44px]"
                    onClick={() => setOpen(true)}
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
                className="custom-mobile-padding flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-24 lg:pb-6"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  minHeight: 0,
                }}
              >
                <AdminErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Outlet />
                  </Suspense>
                </AdminErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>

        {/* Mobile bottom navigation */}
        <MobileBottomNav />

        {/* Quick Actions FAB - hidden on mobile (use bottom nav) */}
        <div className="hidden lg:block">
          <QuickActionsButton />
        </div>

        {/* PWA install */}
        <InstallPWA />

        {/* Credit deduction toasts */}
        <CreditToastContainer />
      </TutorialProvider>
  );
};

export { AdminLayout };
