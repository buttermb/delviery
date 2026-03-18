/**
 * HotBar - Fixed Bottom Navigation
 * 
 * Always visible navigation bar at the bottom of the screen
 * Optimized for the new hub-based navigation structure
 * With real-time badge counts
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  Flame,
  LayoutDashboard,
  DollarSign,
  MoreHorizontal,
  Store,
  Users,
  Truck,
  Settings,
  ShoppingCart,
  Box,
  BarChart3,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { TierBadge } from '../tier/TierBadge';
import { AlertBadge } from '../ui/AlertBadge';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badgeKey?: 'pendingOrders' | 'lowStockItems' | 'unreadMessages' | 'pendingShipments';
}

// Core navigation items - optimized for hub structure with dynamic badges
const coreNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, path: '/admin' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, path: '/admin/orders', badgeKey: 'pendingOrders' },
  { id: 'inventory', label: 'Inventory', icon: Box, path: '/admin/inventory-hub', badgeKey: 'lowStockItems' },
  { id: 'finance', label: 'Finance', icon: DollarSign, path: '/admin/finance-hub' },
];

// More menu categories - aligned with sidebar hubs
const moreCategories = [
  {
    section: 'Hubs',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customer-hub' },
      { id: 'fulfillment', label: 'Fulfillment', icon: Truck, path: '/admin/fulfillment-hub' },
      { id: 'marketing', label: 'Marketing', icon: Megaphone, path: '/admin/marketing-hub' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics-hub' },
    ],
  },
  {
    section: 'Quick Access',
    items: [
      { id: 'hotbox', label: 'Hotbox', icon: Flame, path: '/admin/hotbox' },
      { id: 'live-map', label: 'Live Map', icon: Truck, path: '/admin/live-map' },
      { id: 'pos', label: 'POS System', icon: Store, path: '/admin/pos-system' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
      { id: 'team', label: 'Team', icon: Users, path: '/admin/team-members' },
    ],
  },
];

export function HotBar() {
  const { tenant } = useTenantAdminAuth();
  const { tier } = useBusinessTier();
  const { counts, getBadgeLevel } = useAdminBadgeCounts();
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
        {coreNavItems.map((item) => {
          const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;
          const badgeLevel = item.badgeKey ? getBadgeLevel(item.badgeKey) : 'info';
          
          return (
            <NavLink
              key={item.id}
              to={getFullPath(item.path)}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors relative',
                isActive(item.path)
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5">
                    <AlertBadge level={badgeLevel} count={badgeCount} size="sm" />
                  </span>
                )}
              </div>
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          );
        })}

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

