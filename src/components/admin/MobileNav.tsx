import { logger } from '@/lib/logger';
/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices (hidden on desktop)
 */

import { NavLink, useLocation, Link } from 'react-router-dom';
import Home from "lucide-react/dist/esm/icons/home";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import Menu from "lucide-react/dist/esm/icons/menu";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

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
  const [open, setOpen] = useState(false);
  const { sidebarConfig, hotItems } = useSidebarConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Phase 6: Debug logging for mobile nav
  logger.debug('MobileNav Render', {
    component: 'MobileNav',
    pathname: location.pathname,
    sidebarConfigLength: sidebarConfig?.length || 0,
    hotItemsLength: hotItems?.length || 0,
    isSheetOpen: open
  });
  
  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const handleRefreshAuth = async () => {
    setIsRefreshing(true);
    try {
      localStorage.removeItem('tenant_admin_token');
      localStorage.removeItem('tenant_admin_refresh_token');
      
      toast.success('Refreshing...');
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error('Failed to refresh');
      setIsRefreshing(false);
    }
  };

  // Flatten sidebar config to get all items
  const allSidebarItems = sidebarConfig.flatMap(section => 
    section.items.map(item => ({
      icon: item.icon,
      label: item.label,
      href: item.href
    }))
  );

  // Filter items for "More" menu (exclude main nav items)
  const moreItems = allSidebarItems.filter(item => {
    const mainPaths = mainNavItems.map(i => i.href);
    return !mainPaths.includes(item.href);
  });

  return (
    <>
      {/* Fixed Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border lg:hidden z-50 safe-area-inset-bottom">
        <div className="grid grid-cols-4 gap-1 p-2 safe-area-inset-bottom">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <NavLink
                key={item.href}
                to={item.href}
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
                          to={item.url}
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
                          to={item.path}
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

