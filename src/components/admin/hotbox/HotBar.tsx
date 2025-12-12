/**
 * HotBar - Fixed Bottom Navigation
 * 
 * Always visible navigation bar at the bottom of the screen
 * Based on the 5-tier Hotbox system
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  Flame,
  Package,
  DollarSign,
  BarChart3,
  MoreHorizontal,
  Store,
  Users,
  Truck,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { TierBadge } from '../tier/TierBadge';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

// Core navigation items - always visible
const coreNavItems: NavItem[] = [
  { id: 'hotbox', label: 'Hotbox', icon: Flame, path: '/admin/hotbox' },
  { id: 'orders', label: 'Orders', icon: Package, path: '/admin/orders?tab=menu' },
  { id: 'money', label: 'Money', icon: DollarSign, path: '/admin/finance-hub' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/admin/reports' },
];

// More menu categories
const moreCategories = [
  {
    section: 'Operations',
    items: [
      { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory-hub?tab=stock' },
      { id: 'products', label: 'Products', icon: Store, path: '/admin/inventory-hub?tab=products' },
      { id: 'pos', label: 'POS System', icon: Store, path: '/admin/pos-system' },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { id: 'live-map', label: 'Live Map', icon: Truck, path: '/admin/live-map' },
      { id: 'couriers', label: 'Couriers', icon: Users, path: '/admin/delivery-hub?tab=couriers' },
    ],
  },
  {
    section: 'People',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customer-hub' },
      { id: 'team', label: 'Team', icon: Users, path: '/admin/staff-management' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
      { id: 'billing', label: 'Billing', icon: DollarSign, path: '/admin/settings?section=billing' },
    ],
  },
];

export function HotBar() {
  const { tenant } = useTenantAdminAuth();
  const { tier, preset } = useBusinessTier();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const getFullPath = (path: string) => {
    if (!tenant?.slug) return path;
    return `/${tenant.slug}${path}`;
  };

  const isActive = (path: string) => {
    const fullPath = getFullPath(path);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <nav className="flex items-center justify-around py-2 px-1">
        {coreNavItems.map((item) => (
          <NavLink
            key={item.id}
            to={getFullPath(item.path)}
            className={cn(
              'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors',
              isActive(item.path)
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
            )}
          >
            <item.icon className={cn(
              'h-5 w-5',
              item.id === 'hotbox' && isActive(item.path) && 'text-orange-500'
            )} />
            <span className="text-xs mt-1">{item.label}</span>
          </NavLink>
        ))}

        {/* More Menu */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors',
                moreOpen
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-xs mt-1">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
            <SheetHeader className="flex flex-row items-center justify-between">
              <SheetTitle>Navigation</SheetTitle>
              <TierBadge tier={tier} size="sm" />
            </SheetHeader>
            <div className="mt-4 space-y-6 overflow-y-auto max-h-[calc(70vh-100px)]">
              {moreCategories.map((category) => (
                <div key={category.section}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {category.section}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {category.items.map((item) => (
                      <NavLink
                        key={item.id}
                        to={getFullPath(item.path)}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex flex-col items-center justify-center p-3 rounded-lg border transition-colors',
                          isActive(item.path)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <item.icon className="h-6 w-6 mb-1" />
                        <span className="text-xs text-center">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

