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
  RefreshCw,
  X,
  Settings,
  LogOut,
  HelpCircle,
  User
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdaptiveSidebar } from './sidebar/AdaptiveSidebar';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from './MobileBottomNavErrorBoundary';
import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { queryKeys } from '@/lib/queryKeys';

export function MobileBottomNav() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, logout } = useTenantAdminAuth();
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
      href: '/admin/orders',
      icon: ShoppingCart,
    },
    {
      title: 'Customers',
      href: '/admin/customer-hub',
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
  const justOpenedRef = useRef(false);

  useEffect(() => {
    if (justOpenedRef.current) {
      justOpenedRef.current = false;
      return;
    }

    if (open) {
      setOpen(false);
    }
  }, [location.pathname, open]);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
  };

  return (
    <>
      <OfflineIndicator />
      <MobileErrorBoundary>
        <nav
          className="fixed bottom-0 left-0 right-0 bg-background border-t lg:hidden min-h-[64px] shadow-lg no-print print:hidden z-sticky"
          style={{
            pointerEvents: 'auto',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
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
                  <div className="relative">
                    <Icon className="h-5 w-5 mb-1" aria-hidden="true" />
                  </div>
                  <span className="truncate max-w-full px-1 text-[10px] font-medium leading-tight">{link.title}</span>
                </Link>
              );
            })}

            {/* More menu - using Drawer for native mobile feel */}
            <Drawer
              open={open}
              onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (isOpen) {
                  justOpenedRef.current = true;
                  triggerHaptic('medium');
                  if (tenant?.id) {
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.sidebarPreferences.byUser(tenant.id)
                    });
                    setSidebarError(null);
                  }
                }
              }}
            >
              <DrawerTrigger asChild>
                <button
                  className="flex flex-col items-center justify-center py-2 sm:py-3 px-1 text-[10px] sm:text-xs text-muted-foreground min-h-[48px] w-full touch-manipulation active:scale-95 active:bg-muted/50"
                  style={{ pointerEvents: 'auto' }}
                  aria-label="Open navigation menu"
                  aria-expanded={open}
                >
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5 mb-0.5 sm:mb-1" aria-hidden="true" />
                  <span className="truncate max-w-full">More</span>
                </button>
              </DrawerTrigger>
              <DrawerContent className="h-[85vh] max-h-[85vh] rounded-t-[10px]">
                {/* Accessibility Title */}
                <div className="sr-only">
                  <DrawerTitle>Navigation Menu</DrawerTitle>
                </div>

                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background flex-shrink-0">
                    <span className="text-sm font-semibold">Navigation</span>
                    <div className="flex items-center gap-2">
                      {tenantSlug && (
                        <span className="text-xs text-muted-foreground">{tenantSlug}</span>
                      )}
                      <DrawerClose asChild>
                        <button
                          className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Close menu"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </DrawerClose>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pb-safe overscroll-contain">
                    {!tenant || !tenantSlug ? (
                      <div className="p-4 space-y-4">
                        {/* Fallback Menu when tenant data missing */}
                        <div className="space-y-2">
                          <Link
                            to="/login"
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                            onClick={() => setOpen(false)}
                          >
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">Login</span>
                          </Link>
                          <Link
                            to="/support"
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                            onClick={() => setOpen(false)}
                          >
                            <HelpCircle className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">Support</span>
                          </Link>
                        </div>
                      </div>
                    ) : sidebarError ? (
                      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh] gap-4">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <div className="text-center space-y-2">
                          <h3 className="font-semibold text-lg">Menu Unavailable</h3>
                          <p className="text-sm text-muted-foreground">
                            We couldn't load the full menu.
                          </p>
                        </div>

                        {/* Emergency Links */}
                        <div className="w-full space-y-2 mt-4">
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            asChild
                            onClick={() => setOpen(false)}
                          >
                            <Link to={`/${tenantSlug}/admin/settings`}>
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-destructive"
                            onClick={handleLogout}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Logout
                          </Button>
                        </div>

                        <Button
                          onClick={() => {
                            setSidebarError(null);
                            queryClient.invalidateQueries({
                              queryKey: queryKeys.sidebarPreferences.byUser(tenant.id)
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          onClickCapture={() => triggerHaptic('light')}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Loading
                        </Button>
                      </div>
                    ) : (
                      <ErrorBoundary onError={setSidebarError}>
                        <SidebarProvider
                          style={{
                            '--sidebar-width': '100%',
                            '--sidebar-width-icon': '3rem',
                            height: '100%',
                            minHeight: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                          } as React.CSSProperties}
                        >
                          <div
                            className="overflow-x-hidden pb-4 pt-4 px-2 -webkit-overflow-scrolling-touch bg-background w-full"
                            style={{
                              height: '100%',
                              minHeight: '100%',
                              flex: '1 1 auto'
                            }}
                          >
                            <AdaptiveSidebar collapsible="none" />
                          </div>
                        </SidebarProvider>
                      </ErrorBoundary>
                    )}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </nav>
      </MobileErrorBoundary>
    </>
  );
}
