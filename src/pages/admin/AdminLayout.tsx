import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ChevronRight, Search, Keyboard } from "lucide-react";
import InstallPWA from "@/components/InstallPWA";
import { Suspense, useState } from "react";
import { LoadingFallback } from "@/components/LoadingFallback";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import ThemeToggle from "@/components/ThemeToggle";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { AdminKeyboardShortcutsDialog } from "@/components/admin/AdminKeyboardShortcutsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Enable keyboard shortcuts
  const { shortcutsVisible, setShortcutsVisible } = useAdminKeyboardShortcuts();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/admin/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = paths.map((path, index) => {
      const url = '/' + paths.slice(0, index + 1).join('/');
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center px-2 md:px-4 gap-2 md:gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 pt-safe">
            <SidebarTrigger className="h-10 w-10 touch-manipulation active:scale-95 transition-transform" />
            
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
                      className="hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md ml-auto">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search... (Cmd+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 h-9"
                />
              </div>
            </form>
            
            {/* Header Actions */}
            <div className="flex items-center gap-2 ml-auto md:ml-0">
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
          <main className="flex-1 overflow-auto bg-muted/10 pb-safe">
            <AdminErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Outlet />
              </Suspense>
            </AdminErrorBoundary>
          </main>
        </div>
      </div>
      <InstallPWA />
    </SidebarProvider>
  );
};

export default AdminLayout;
