import { Outlet, useLocation, Link, useNavigate, useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdaptiveSidebar } from "@/components/admin/sidebar/AdaptiveSidebar";
import { SidebarErrorBoundary } from "@/components/admin/sidebar/SidebarErrorBoundary";
import { MobileBottomNav } from "@/components/admin/MobileBottomNav";
import { AccountSwitcher } from "@/components/admin/AccountSwitcher";
import { ChevronRight, Search, Keyboard } from "lucide-react";
import InstallPWA from "@/components/InstallPWA";
import { Suspense, useState } from "react";
import { LoadingFallback } from "@/components/LoadingFallback";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
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
import { logger } from "@/lib/logger";
import { useEffect } from "react";

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
  
  // DEBUG: Log route changes to diagnose navigation issues
  useEffect(() => {
    if (tenantSlug) {
      logRouteState(tenantSlug, location.pathname);
      logger.debug('AdminLayout route change', { 
        tenantSlug, 
        pathname: location.pathname,
        scrollable: document.body.style.overflow !== 'hidden'
      });
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
            <header className="h-12 sm:h-14 border-b border-border flex items-center px-2 sm:px-3 md:px-4 lg:px-6 gap-2 sm:gap-3 md:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 pt-safe shadow-sm safe-area-top">
              <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10 min-h-[48px] min-w-[48px] touch-manipulation active:scale-95 transition-transform z-50" />
              
              {/* Breadcrumbs */}
              <nav className="hidden md:flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-hide">
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
              
              {/* Header Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AdminKeyboardShortcutsDialog 
                        open={shortcutsVisible} 
                        onOpenChange={setShortcutsVisible} 
                      />
                    </TooltipTrigger>
                    <TooltipContent>Keyboard Shortcuts (? or click)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <AdminNotificationCenter />
                <ThemeToggle />
              </div>
            </header>
            <main 
              className="custom-mobile-padding flex-1 overflow-y-auto overflow-x-hidden bg-muted/30 pb-24 lg:pb-6 safe-area-bottom -webkit-overflow-scrolling-touch"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                height: '100%',
                minHeight: 0
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
      
      {/* PWA install */}
      <InstallPWA />
    </TutorialProvider>
  );
};

export default AdminLayout;
