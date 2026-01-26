/**
 * Live Badge Context
 *
 * Provides real-time badge counts to sidebar navigation items.
 * Maps specific navigation paths to their live counts from useAdminBadgeCounts.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAdminBadgeCounts, type BadgeCounts } from '@/hooks/useAdminBadgeCounts';

type BadgeLevel = 'critical' | 'warning' | 'info' | 'success';

export interface LiveBadgeInfo {
  count: number;
  level: BadgeLevel;
  pulse: boolean;
}

interface LiveBadgeContextType {
  getBadge: (path: string) => LiveBadgeInfo | null;
  counts: BadgeCounts;
  isLoading: boolean;
}

const LiveBadgeContext = createContext<LiveBadgeContextType | undefined>(undefined);

/**
 * Navigation paths that display live count badges.
 * Maps item path to the badge count key from useAdminBadgeCounts.
 *
 * Badge counts are updated in real-time via Supabase subscriptions:
 * - pendingOrders: wholesale_orders + menu_orders with pending status
 * - lowStockItems: products with stock below threshold
 * - inventoryAlerts: active inventory_alerts (not resolved/dismissed/snoozed)
 * - unreadMessages: open conversations
 * - pendingShipments: deliveries with assigned/picked_up status
 */
const BADGE_PATH_MAP: Record<string, keyof BadgeCounts> = {
  '/admin/orders': 'pendingOrders',
  '/admin/inventory-hub': 'lowStockItems',
  '/admin/stock-alerts': 'inventoryAlerts',
  '/admin/inventory-alerts': 'inventoryAlerts',
  '/admin/alerts': 'inventoryAlerts',
  '/admin/live-chat': 'unreadMessages',
  '/admin/notifications': 'unreadMessages',
  '/admin/dispatch-inventory': 'pendingShipments',
  '/admin/delivery-tracking': 'pendingShipments',
};

interface LiveBadgeProviderProps {
  children: ReactNode;
}

export function LiveBadgeProvider({ children }: LiveBadgeProviderProps) {
  const { counts, isLoading, getBadgeLevel } = useAdminBadgeCounts();

  const getBadge = useMemo(() => {
    return (path: string): LiveBadgeInfo | null => {
      const countKey = BADGE_PATH_MAP[path];
      if (!countKey) return null;

      const count = counts[countKey];
      if (count <= 0) return null;

      const level = getBadgeLevel(countKey);
      const pulse = level === 'critical';

      return { count, level, pulse };
    };
  }, [counts, getBadgeLevel]);

  const value: LiveBadgeContextType = {
    getBadge,
    counts,
    isLoading,
  };

  return (
    <LiveBadgeContext.Provider value={value}>
      {children}
    </LiveBadgeContext.Provider>
  );
}

export function useLiveBadge() {
  const context = useContext(LiveBadgeContext);
  if (context === undefined) {
    return null;
  }
  return context;
}
