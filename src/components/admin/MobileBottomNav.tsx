import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/utils/mobile';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Map,
  Menu,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdaptiveSidebar } from './sidebar/AdaptiveSidebar';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from './MobileBottomNavErrorBoundary';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';
import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';

export function MobileBottomNav() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sidebarError, setSidebarError] = useState<Error | null>(null);
  const { isNavigating } = useMobileNavigation();

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

  // Close sheet when route changes (user navigates)
  // Use a ref to track if we just opened the sheet to prevent immediate closing
  const justOpenedRef = useRef(false);
  
  useEffect(() => {
    // Don't close if we just opened (give it time to render)
    if (justOpenedRef.current) {
      justOpenedRef.current = false;
      return;
    }
    
    if (open) {
      setOpen(false);
    }
  }, [location.pathname]); // Close sheet on route change, but not on open state change

  return (
    <>
      <OfflineIndicator />
      <MobileErrorBoundary>
        <nav 
          className="fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur border-t lg:hidden min-h-[64px] safe-area-bottom shadow-lg"
          style={{ pointerEvents: 'auto' }}
          role="navigation"
          aria-label="Mobile bottom navigation"
        >
          {/* Loading indicator */}
          {isNavigating && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/30 overflow-hidden">
              <div className="h-full bg-primary animate-[shimmer_1s_ease-in-out_infinite]" style={{
                backgroundImage: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1s ease-in-out infinite'
              }} />
            </div>
          )}
          
          <div className="grid grid-cols-5 h-full items-center">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const fullPath = getFullPath(link.href);
          const active = isActive(link.href);

          return (
            <Link
              key={link.href}
              to={fullPath}
              onClick={() => {
                triggerHaptic('light');
                logger.debug('MobileBottomNav click', { 
                  href: link.href, 
                  fullPath,
                  title: link.title 
                });
              }}
              className={cn(
                'flex flex-col items-center justify-center py-2 sm:py-3 px-1 text-[10px] sm:text-xs transition-colors min-h-[48px] w-full touch-manipulation active:scale-95 active:bg-muted/50',
                active
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-muted-foreground'
              )}
              style={{ pointerEvents: 'auto' }}
              aria-label={`Navigate to ${link.title}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" aria-hidden="true" />
              <span className="truncate max-w-full px-1">{link.title}</span>
            </Link>
          );
        })}

        {/* More menu */}
        <Sheet 
          open={open} 
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (isOpen) {
              justOpenedRef.current = true;
              logger.debug('MobileBottomNav sheet opened', { context: 'admin' });
              if (tenant?.id) {
                queryClient.invalidateQueries({ 
                  queryKey: ['sidebar-preferences', tenant.id] 
                });
                setSidebarError(null);
              }
            }
          }}
        >
          <SheetTrigger asChild>
            <button 
              onClick={() => {
                triggerHaptic('medium');
                logger.debug('MobileBottomNav More button clicked');
              }}
              className="flex flex-col items-center justify-center py-2 sm:py-3 px-1 text-[10px] sm:text-xs text-muted-foreground min-h-[48px] w-full touch-manipulation active:scale-95 active:bg-muted/50"
              style={{ pointerEvents: 'auto' }}
              aria-label="Open navigation menu"
              aria-expanded={open}
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" aria-hidden="true" />
              <span className="truncate max-w-full">More</span>
            </button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="z-[120] p-0 w-[85vw] max-w-sm mobile-input-container flex flex-col overflow-hidden bg-background"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80">
                <span className="text-sm font-medium">More navigation</span>
              </div>
              
              <div className="flex-1 overflow-y-auto pb-safe">
                <SidebarProvider
                  style={{
                    '--sidebar-width': '100%',
                    '--sidebar-width-icon': '3rem',
                  } as React.CSSProperties}
                >
                  <div className="flex-1 overflow-y-auto overflow-x-hidden pb-8 pt-4 px-2 -webkit-overflow-scrolling-touch bg-background min-h-0 w-full">
                    {!tenant ? (
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : sidebarError ? (
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
                        <div className="w-full" style={{ minHeight: '100%' }}>
                          <AdaptiveSidebar collapsible="none" />
                        </div>
                      </ErrorBoundary>
                    )}
                  </div>
                </SidebarProvider>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
    </MobileErrorBoundary>
    </>
  );
}

