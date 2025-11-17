/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices (hidden on desktop)
 */

import { NavLink, useLocation } from 'react-router-dom';
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
  const { sidebarConfig } = useSidebarConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
          <Sheet>
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
            <SheetContent side="bottom" className="h-[60vh] flex flex-col overflow-hidden">
              <div className="space-y-4 mt-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">More Options</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshAuth}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
                
                {moreItems.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">
                      No additional items available
                    </p>
                    <Button onClick={handleRefreshAuth} disabled={isRefreshing} variant="outline">
                      <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                      Try Refreshing
                    </Button>
                  </div>
                )}
                
                {moreItems.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {moreItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      
                      return (
                        <NavLink
                          key={item.href}
                          to={item.href}
                          className={cn(
                            'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-colors touch-manipulation active:scale-95',
                            active
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border'
                          )}
                        >
                          <Icon className="h-6 w-6" />
                          <span className="text-sm font-medium">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}

