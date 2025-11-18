import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Map,
  Menu,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdaptiveSidebar } from './sidebar/AdaptiveSidebar';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from './MobileBottomNavErrorBoundary';
import { logger } from '@/lib/logger';

export function MobileBottomNav() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sidebarError, setSidebarError] = useState<Error | null>(null);

  const quickLinks = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard
    },
    {
      title: 'Orders',
      href: '/admin/wholesale-orders',
      icon: ShoppingCart
    },
    {
      title: 'Customers',
      href: '/admin/big-plug-clients',
      icon: Users
    },
    {
      title: 'Drivers',
      href: '/admin/live-map',
      icon: Map
    }
  ];

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    // If href already starts with /admin, prepend tenant slug
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const isActive = (href: string) => {
    const fullPath = getFullPath(href);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur border-t lg:hidden h-[60px] pb-safe shadow-lg"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory gap-0.5 sm:gap-1 px-1"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const fullPath = getFullPath(link.href);
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={fullPath}
              onClick={() => {
                logger.debug('MobileBottomNav click', { 
                  href: link.href, 
                  fullPath,
                  title: link.title 
                });
              }}
              className={cn(
                'flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs transition-colors min-h-[44px] min-w-[70px] flex-shrink-0 snap-center touch-manipulation active:scale-95 active:bg-muted/50',
                active
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-muted-foreground'
              )}
              style={{ pointerEvents: 'auto' }}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" />
              <span className="truncate max-w-full px-1">{link.title}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet 
          open={open} 
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            // Phase 2: Force preferences refresh when sheet opens
            if (isOpen && tenant?.id) {
              queryClient.invalidateQueries({ 
                queryKey: ['sidebar-preferences', tenant.id] 
              });
              setSidebarError(null);
            }
          }}
        >
          <SheetTrigger asChild>
            <button 
              onClick={() => {
                logger.debug('MobileBottomNav More button clicked');
              }}
              className="flex flex-col items-center justify-center py-2 sm:py-3 text-[10px] sm:text-xs text-muted-foreground min-h-[44px] min-w-[70px] flex-shrink-0 snap-center touch-manipulation active:scale-95 active:bg-muted/50"
              style={{ pointerEvents: 'auto' }}
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" />
              <span className="truncate max-w-full px-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="p-0 w-[85vw] max-w-sm mobile-input-container h-[80vh] max-h-[calc(100vh-80px)] flex flex-col overflow-hidden"
            style={{ zIndex: 60 }}
          >
            <SidebarProvider>
              <div className="flex-1 overflow-y-auto overflow-x-hidden pb-8 pt-4 px-2 -webkit-overflow-scrolling-touch bg-background">
                {/* Phase 1: Add loading state & tenant check */}
                {!tenant ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : sidebarError ? (
                  /* Phase 5: Error boundary fallback */
                  <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] gap-4">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold text-lg">Something went wrong</h3>
                      <p className="text-sm text-muted-foreground">
                        {sidebarError.message || 'Failed to load navigation menu'}
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        setSidebarError(null);
                        queryClient.invalidateQueries({ 
                          queryKey: ['sidebar-preferences', tenant.id] 
                        });
                      }}
                      variant="outline"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <ErrorBoundary onError={setSidebarError}>
                    <AdaptiveSidebar collapsible="none" />
                  </ErrorBoundary>
                )}
              </div>
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

