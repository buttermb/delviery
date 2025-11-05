import { Outlet, useLocation, Link, useNavigate, useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TenantAdminSidebar } from "@/components/tenant-admin/TenantAdminSidebar";
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
    
    // Skip tenant slug in breadcrumbs if present
    const startIndex = tenantSlug && paths[0] === tenantSlug ? 1 : 0;
    const relevantPaths = paths.slice(startIndex);
    
    const breadcrumbs = relevantPaths.map((path, index) => {
      const pathSlice = relevantPaths.slice(0, index + 1);
      const url = tenantSlug 
        ? `/${tenantSlug}/${pathSlice.join('/')}`
        : '/' + pathSlice.join('/');
      
      const label = path
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return { label, url };
    });
    
    // Add tenant name as first breadcrumb if tenant slug exists
    if (tenantSlug && breadcrumbs.length > 0) {
      return [
        { label: tenantSlug, url: tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard' },
        ...breadcrumbs
      ];
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      {/* Command Palette */}
      <TenantAdminCommandPalette />
      
      {/* Unified Layout with TenantAdminSidebar */}
      <SidebarProvider>
        <div className="min-h-screen flex w-full overflow-hidden">
          <TenantAdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AccountSwitcher />
            <header className="h-14 border-b border-border flex items-center px-2 md:px-4 lg:px-6 gap-2 md:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 pt-safe shadow-sm safe-area-top">
              <SidebarTrigger className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation active:scale-95 transition-transform" />
              
              {/* Breadcrumbs */}
              <nav className="hidden md:flex items-center gap-2 text-xs md:text-sm text-muted-foreground overflow-x-auto scrollbar-hide">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.url} className="flex items-center gap-2 flex-shrink-0">
                    {index > 0 && <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-foreground whitespace-nowrap">{crumb.label}</span>
                    ) : (
                      <Link 
                        to={crumb.url}
                        className="hover:text-foreground text-muted-foreground transition-colors whitespace-nowrap"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
              
              {/* Header Actions */}
              <div className="flex items-center gap-2 ml-auto">
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
            <main className="flex-1 overflow-auto bg-muted/30 pb-20 lg:pb-6 safe-area-bottom">
              <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-full">
                <AdminErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Outlet />
                  </Suspense>
                </AdminErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      
      {/* PWA install */}
      <InstallPWA />
    </>
  );
};

export default AdminLayout;
