/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices (hidden on desktop)
 */

import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Package, 
  Users, 
  MapPin, 
  Menu,
  ShoppingCart,
  Truck,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Home', href: '/admin/dashboard' },
  { icon: Package, label: 'Orders', href: '/admin/orders' },
  { icon: Users, label: 'Customers', href: '/admin/customers' },
  { icon: Truck, label: 'Drivers', href: '/admin/live-map' },
];

const moreNavItems: NavItem[] = [
  { icon: ShoppingCart, label: 'Inventory', href: '/admin/inventory' },
  { icon: BarChart3, label: 'Analytics', href: '/admin/sales-dashboard' },
  { icon: MapPin, label: 'Map', href: '/admin/live-map' },
];

export function MobileNav() {
  const location = useLocation();
  
  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Fixed Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border lg:hidden z-50 safe-area-inset-bottom">
        <div className="grid grid-cols-5 gap-1 p-2 safe-area-inset-bottom">
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
            <SheetContent side="bottom" className="h-[60vh]">
              <div className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">More Options</h3>
                <div className="grid grid-cols-2 gap-3">
                  {moreNavItems.map((item) => {
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
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}

