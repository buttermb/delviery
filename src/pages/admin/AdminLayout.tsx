import { logger } from '@/lib/logger';
import { Outlet, useLocation, Link, useNavigate, useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
import { SidebarErrorBoundary } from "@/components/admin/sidebar/SidebarErrorBoundary";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { AccountSwitcher } from "@/components/admin/AccountSwitcher";
import { ChevronRight, Search, Keyboard } from "lucide-react";
import InstallPWA from "@/components/InstallPWA";
import { Suspense, useState } from "react";
import { LoadingFallback } from "@/components/LoadingFallback";

import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import ThemeToggle from "@/components/ThemeToggle";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { AdminKeyboardShortcutsDialog } from "@/components/admin/AdminKeyboardShortcutsDialog";
import { TenantAdminCommandPalette } from "@/components/tenant-admin/CommandPalette";
import { MobileNav } from "@/components/admin/MobileNav";
import { Input } from "@/components/ui/input";
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

/**
 * Admin Layout Component - v2.1.1
 * Provides the main layout structure for all admin pages
 * Updated: 2025-10-31
 */
const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Enable keyboard shortcuts
  const { shortcutsVisible, setShortcutsVisible } = useAdminKeyboardShortcuts();

  // Force module refresh
  const moduleVersion = "2.1.0";

  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Log route changes only in development (not on every render)
  useEffect(() => {
    if (tenantSlug && import.meta.env.DEV) {
      logRouteState(tenantSlug, location.pathname);
    }
  }, [tenantSlug, location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const searchPath = tenantSlug
        ? `/${tenantSlug}/admin/global-search?q=${encodeURIComponent(searchQuery)}`
        : `/admin/search?q=${encodeURIComponent(searchQuery)}`;
      navigate(searchPath);
      setSearchQuery("");
    }
  };

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);

    // Skip tenant slug in breadcrumbs
    const startIndex = tenantSlug && paths[0] === tenantSlug ? 1 : 0;
    const relevantPaths = paths.slice(startIndex);

    // Skip 'admin' from breadcrumbs as it's implied
    const filteredPaths = relevantPaths.filter(path => path !== 'admin');

    const breadcrumbs = filteredPaths.map((path, index) => {
      const pathSlice = filteredPaths.slice(0, index + 1);
      const url = tenantSlug
        ? `/${tenantSlug}/admin/${pathSlice.join('/')}`
        : `/admin/${pathSlice.join('/')}`;

      const label = path
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return { label, url };
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <TutorialProvider>
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Command Palette */}
      <TenantAdminCommandPalette />

      {/* Unified Layout with AdaptiveSidebar */}
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <SidebarErrorBoundary>
            <AdaptiveSidebar />
          </SidebarErrorBoundary>
          <div className="flex-1 flex flex-col min-w-0">
            <AccountSwitcher />
            <header className="h-14 sm:h-14 border-b border-border flex items-center px-2 sm:px-3 md:px-4 lg:px-6 gap-2 sm:gap-3 md:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 pt-safe shadow-sm safe-area-top">
              {/* Sidebar trigger - 48px minimum touch target */}
              <SidebarTrigger className="h-12 w-12 min-h-[48px] min-w-[48px] touch-manipulation active:scale-95 transition-transform z-50 -ml-1 sm:ml-0 flex items-center justify-center" />

              {/* Breadcrumbs - hidden on mobile */}
              <nav className="hidden md:flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-hide flex-1 min-w-0">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.url} className="flex items-center gap-1.5 flex-shrink-0">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="font-semibold text-foreground whitespace-nowrap">{crumb.label}</span>
                    ) : (
                      <Link
                        to={crumb.url}
                        className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap font-medium"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>

              {/* Mobile page title - show current page on mobile */}
              <div className="md:hidden flex-1 min-w-0">
                {breadcrumbs.length > 0 && (
                  <span className="font-semibold text-sm truncate block">
                    {breadcrumbs[breadcrumbs.length - 1]?.label || 'Dashboard'}
                  </span>
                )}
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1 sm:gap-2 ml-auto flex-shrink-0">
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
                
                {/* Theme toggle - optimized touch target */}
                <div className="[&>button]:h-10 [&>button]:w-10 [&>button]:min-h-[44px] [&>button]:min-w-[44px]">
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main
              className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/30 pb-24 lg:pb-6 safe-area-bottom p-3 sm:p-4 md:p-6"
              style={{
                WebkitOverflowScrolling: 'touch',
                height: '100%',
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
    </TutorialProvider>
  );
};

export default AdminLayout;
