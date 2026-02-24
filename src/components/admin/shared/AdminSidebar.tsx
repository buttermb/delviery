/**
 * AdminSidebar Component
 *
 * Main admin sidebar with collapsible sections.
 * Groups: Dashboard, Orders, Products & Inventory, Customers, Vendors,
 * Menus & Storefront, Deliveries, Analytics, Settings.
 *
 * Features:
 * - Collapsible sections with persistent state
 * - Active item highlighting
 * - Badge counts for pending orders, low stock, unread notifications
 * - Collapse to icon-only mode
 * - Persists collapsed state to localStorage
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Building2,
  Store,
  Truck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';

// Storage key for sidebar state
const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';
const SIDEBAR_SECTIONS_KEY = 'admin-sidebar-sections';

/**
 * Navigation item structure
 */
interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badgeKey?: 'pendingOrders' | 'lowStock' | 'unreadNotifications' | 'pendingDeliveries';
}

/**
 * Navigation section structure
 */
interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  defaultExpanded?: boolean;
}

/**
 * Badge counts interface
 */
interface BadgeCounts {
  pendingOrders: number;
  lowStock: number;
  unreadNotifications: number;
  pendingDeliveries: number;
}

/**
 * Default navigation sections
 */
const navigationSections: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    defaultExpanded: true,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    defaultExpanded: true,
    items: [
      { id: 'orders', label: 'All Orders', icon: ShoppingCart, href: '/admin/orders', badgeKey: 'pendingOrders' },
    ],
  },
  {
    id: 'products-inventory',
    label: 'Products & Inventory',
    items: [
      { id: 'products', label: 'Products', icon: Package, href: '/admin/inventory/products' },
      { id: 'inventory', label: 'Inventory', icon: Package, href: '/admin/inventory-hub', badgeKey: 'lowStock' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, href: '/admin/customers' },
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    items: [
      { id: 'vendors', label: 'Vendors', icon: Building2, href: '/admin/vendor-management' },
    ],
  },
  {
    id: 'menus-storefront',
    label: 'Menus & Storefront',
    items: [
      { id: 'menus', label: 'Disposable Menus', icon: Store, href: '/admin/disposable-menus' },
      { id: 'storefront', label: 'Storefront', icon: Store, href: '/admin/storefront' },
    ],
  },
  {
    id: 'deliveries',
    label: 'Deliveries',
    items: [
      { id: 'deliveries', label: 'Delivery Management', icon: Truck, href: '/admin/delivery-management', badgeKey: 'pendingDeliveries' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics Hub', icon: BarChart3, href: '/admin/analytics-hub' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
      { id: 'notifications', label: 'Notifications', icon: Bell, href: '/admin/notifications', badgeKey: 'unreadNotifications' },
    ],
  },
];

/**
 * Get persisted sidebar collapsed state from localStorage
 */
function getPersistedCollapsedState(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Get persisted section states from localStorage
 */
function getPersistedSectionStates(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(SIDEBAR_SECTIONS_KEY);
    if (stored) {
      return JSON.parse(stored) as Record<string, boolean>;
    }
  } catch {
    // Ignore parse errors
  }
  // Default: expand sections marked as defaultExpanded
  const defaults: Record<string, boolean> = {};
  navigationSections.forEach(section => {
    defaults[section.id] = section.defaultExpanded ?? false;
  });
  return defaults;
}

/**
 * Save sidebar collapsed state to localStorage
 */
function persistCollapsedState(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    logger.warn('Failed to persist sidebar collapsed state', { component: 'AdminSidebar' });
  }
}

/**
 * Save section states to localStorage
 */
function persistSectionStates(states: Record<string, boolean>): void {
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(states));
  } catch {
    logger.warn('Failed to persist sidebar section states', { component: 'AdminSidebar' });
  }
}

/**
 * Props for AdminSidebar component
 */
export interface AdminSidebarProps {
  /** Badge counts for navigation items */
  badgeCounts?: Partial<BadgeCounts>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AdminSidebar - Main admin navigation sidebar
 *
 * Provides:
 * - Collapsible sections with memory
 * - Active item highlighting based on current route
 * - Badge counts for pending items
 * - Icon-only mode with tooltips
 * - Tenant-aware navigation
 */
export function AdminSidebar({ badgeCounts = {}, className }: AdminSidebarProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const location = useLocation();
  const { prefetchRoute } = useRoutePrefetch();

  // Sidebar collapsed state (icon-only mode)
  const [isCollapsed, setIsCollapsed] = useState(getPersistedCollapsedState);

  // Section expanded states
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(getPersistedSectionStates);

  // Merge badge counts with defaults
  const badges: BadgeCounts = useMemo(() => ({
    pendingOrders: badgeCounts.pendingOrders ?? 0,
    lowStock: badgeCounts.lowStock ?? 0,
    unreadNotifications: badgeCounts.unreadNotifications ?? 0,
    pendingDeliveries: badgeCounts.pendingDeliveries ?? 0,
  }), [badgeCounts]);

  // Check if a path is active
  const isActive = useCallback((href: string): boolean => {
    if (!tenantSlug) return false;
    const fullPath = `/${tenantSlug}${href}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  }, [tenantSlug, location.pathname]);

  // Toggle sidebar collapsed state
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      persistCollapsedState(newState);
      return newState;
    });
  }, []);

  // Toggle section expanded state
  const toggleSection = useCallback((sectionId: string) => {
    setSectionStates(prev => {
      const newStates = { ...prev, [sectionId]: !prev[sectionId] };
      persistSectionStates(newStates);
      return newStates;
    });
  }, []);

  // Auto-expand section when it contains active item
  useEffect(() => {
    navigationSections.forEach(section => {
      const hasActiveItem = section.items.some(item => isActive(item.href));
      if (hasActiveItem && !sectionStates[section.id]) {
        setSectionStates(prev => {
          const newStates = { ...prev, [section.id]: true };
          persistSectionStates(newStates);
          return newStates;
        });
      }
    });
  }, [location.pathname, isActive, sectionStates]);

  // Guard against missing tenant slug
  if (!tenantSlug) {
    logger.error('AdminSidebar rendered without tenantSlug', new Error('Missing tenantSlug'), { component: 'AdminSidebar' });
    return null;
  }

  // Get badge value for an item
  const getBadgeValue = (badgeKey?: NavItem['badgeKey']): number | undefined => {
    if (!badgeKey) return undefined;
    const value = badges[badgeKey];
    return value > 0 ? value : undefined;
  };

  // Render a single navigation item
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const badgeValue = getBadgeValue(item.badgeKey);
    const Icon = item.icon;

    const linkContent = (
      <NavLink
        to={`/${tenantSlug}${item.href}`}
        onMouseEnter={() => prefetchRoute(`/${tenantSlug}${item.href}`)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          active && 'bg-accent text-accent-foreground font-medium',
          isCollapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', item.badgeKey === 'lowStock' && badgeValue && 'text-orange-500')} />
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {badgeValue !== undefined && (
              <Badge
                variant={item.badgeKey === 'lowStock' ? 'destructive' : 'secondary'}
                className="ml-auto h-5 px-1.5 text-xs"
              >
                {badgeValue > 99 ? '99+' : badgeValue}
              </Badge>
            )}
          </>
        )}
        {isCollapsed && badgeValue !== undefined && (
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive" />
        )}
      </NavLink>
    );

    // Show tooltip in collapsed mode
    if (isCollapsed) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="relative">{linkContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {badgeValue !== undefined && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {badgeValue}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.id}>{linkContent}</div>;
  };

  // Render a navigation section
  const renderSection = (section: NavSection) => {
    const isExpanded = sectionStates[section.id] ?? false;
    const hasActiveItem = section.items.some(item => isActive(item.href));

    // In collapsed mode, just show items without section header
    if (isCollapsed) {
      return (
        <div key={section.id} className="space-y-1">
          {section.items.map(renderNavItem)}
        </div>
      );
    }

    return (
      <Collapsible
        key={section.id}
        open={isExpanded}
        onOpenChange={() => toggleSection(section.id)}
      >
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              'flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
              'hover:text-foreground transition-colors cursor-pointer',
              hasActiveItem && 'text-foreground'
            )}
          >
            <span>{section.label}</span>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {section.items.map(renderNavItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex flex-col h-full border-r bg-background transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center border-b p-3',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                {tenant?.slug?.charAt(0).toUpperCase() || 'T'}
              </div>
              <span className="font-semibold text-sm truncate">
                {tenant?.business_name || tenant?.slug || 'Admin'}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')} />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-4">
            {navigationSections.map(renderSection)}
          </nav>
        </ScrollArea>

        {/* Footer - Low stock warning indicator */}
        {badges.lowStock > 0 && (
          <div className={cn(
            'border-t p-3',
            isCollapsed && 'flex justify-center'
          )}>
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="p-2 rounded-md bg-orange-500/10">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {badges.lowStock} items low on stock
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{badges.lowStock} items low on stock</span>
              </div>
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

export default AdminSidebar;
