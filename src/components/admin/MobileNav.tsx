import { logger } from '@/lib/logger';
/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices (hidden on desktop)
 */

import { NavLink, useLocation, useParams, Link } from 'react-router-dom';
import {
  Home,
  Package,
  Users,
  Menu,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useState } from 'react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Badge } from '@/components/ui/badge';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Home', href: '/admin/dashboard' },
  { icon: Package, label: 'Orders', href: '/admin/orders' },
  { icon: Users, label: 'Customers', href: '/admin/customers' },
];

export function MobileNav() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [open, setOpen] = useState(false);
  const { sidebarConfig, hotItems } = useSidebarConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Phase 6: Debug logging for mobile nav
  logger.debug('MobileNav Render', {
    component: 'MobileNav',
    pathname: location.pathname,
    sidebarConfigLength: sidebarConfig?.length ?? 0,
    hotItemsLength: hotItems?.length ?? 0,
    isSheetOpen: open
  });

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const isActive = (href: string) => {
    const fullPath = getFullPath(href);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleRefreshAuth = async () => {
    setIsRefreshing(true);
    try {
      localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN);
      
      toast.success('Refreshing...');
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error('Failed to refresh', { description: humanizeError(error) });
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {/* Fixed Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border lg:hidden z-50 pb-safe">
        <div className="grid grid-cols-4 gap-1 p-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <NavLink
                key={item.href}
                to={getFullPath(item.href)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors touch-manipulation active:scale-95',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
          
          {/* More Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'flex flex-col items-center justify-center gap-1 p-2 h-auto rounded-lg touch-manipulation active:scale-95',
                  'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Menu className="h-5 w-5" />
                <span className="text-xs font-medium">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] flex flex-col overflow-hidden">
              <div className="space-y-4 mt-4 pb-6 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">All Menu Items</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </Button>
                </div>
                
                {/* Phase 5: Show ALL sidebar items grouped by section */}
                {sidebarConfig && sidebarConfig.map(section => (
                  <div key={section.section} className="space-y-2">
                    <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.section}
                    </div>
                    {section.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={getFullPath(item.url)}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50",
                            isActive(item.url) && "bg-accent text-accent-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {item.badge}
                            </Badge>
                          )}
                          {item.hot && (
                            <Badge variant="destructive" className="ml-auto text-xs">
                              Hot
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}

                {/* Hot Items Section */}
                {hotItems && hotItems.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Quick Actions
                    </div>
                    {hotItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={getFullPath(item.path)}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50",
                            isActive(item.path) && "bg-accent text-accent-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Refresh Auth Button */}
                <button
                  type="button"
                  onClick={handleRefreshAuth}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50 w-full mt-4 border-t pt-4"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
                  <span className="font-medium">Refresh</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}

