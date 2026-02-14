/**
 * useDashboardActivity Hook
 * Pulls the last 20 actions across orders, customers,
 * and disposable menus -- merged and sorted by created_at DESC.
 * Each item carries type, title, description, timestamp, and deep-link.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export type ActivityType = 'order' | 'product' | 'customer' | 'payment' | 'menu' | 'delivery';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  createdAt: string;
  /** Relative admin path (without leading tenant slug) */
  linkPath: string;
}

export function useDashboardActivity() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.activity(tenantId),
    queryFn: async (): Promise<ActivityItem[]> => {
      if (!tenantId) return [];

      const items: ActivityItem[] = [];

      // Run queries in parallel using typed any to avoid deep instantiation
      const [ordersResult, customersResult, menusResult, deliveriesResult] = await Promise.allSettled([
        // Recent orders (last 10)
        (supabase as any)
          .from('orders')
          .select('id, status, total_amount, created_at, customer_name')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10),

        // Recent customers (last 5) - use first_name, last_name instead of name
        (supabase as any)
          .from('customers')
          .select('id, first_name, last_name, email, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),

        // Recent menus (last 5)
        (supabase as any)
          .from('disposable_menus')
          .select('id, name, status, created_at, burned_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),

        // Recent deliveries (last 5)
        (supabase as any)
          .from('wholesale_deliveries')
          .select('id, status, created_at, order_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Process orders
      if (ordersResult.status === 'fulfilled' && !ordersResult.value.error) {
        const ordersData = (ordersResult.value.data ?? []) as Array<{
          id: string;
          status?: string;
          total_amount?: number;
          created_at: string;
          customer_name?: string;
        }>;
        ordersData.forEach((order) => {
          const customerLabel = order.customer_name ?? 'Customer';
          items.push({
            id: `order-${order.id}`,
            type: 'order',
            title: `Order ${formatStatus(String(order.status ?? 'pending'))}`,
            description: `${customerLabel} -- $${Number(order.total_amount ?? 0).toFixed(2)}`,
            createdAt: order.created_at,
            linkPath: `orders`,
          });
        });
      } else if (ordersResult.status === 'fulfilled' && ordersResult.value.error) {
        logger.warn('Activity feed: orders query failed', ordersResult.value.error, { component: 'useDashboardActivity' });
      }

      // Process customers
      if (customersResult.status === 'fulfilled' && !customersResult.value.error) {
        const customersData = (customersResult.value.data ?? []) as Array<{
          id: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          created_at: string;
        }>;
        customersData.forEach((cust) => {
          const displayName = [cust.first_name, cust.last_name].filter(Boolean).join(' ') || cust.email || 'Unknown';
          items.push({
            id: `customer-${cust.id}`,
            type: 'customer',
            title: 'New Customer',
            description: displayName,
            createdAt: cust.created_at,
            linkPath: `customer-hub`,
          });
        });
      }

      // Process menus
      if (menusResult.status === 'fulfilled' && !menusResult.value.error) {
        const menusData = (menusResult.value.data ?? []) as Array<{
          id: string;
          name: string;
          status?: string;
          created_at: string;
          burned_at?: string | null;
        }>;
        menusData.forEach((menu) => {
          const isBurned = !!menu.burned_at;
          items.push({
            id: `menu-${menu.id}`,
            type: 'menu',
            title: isBurned ? 'Menu Burned' : `Menu ${formatStatus(String(menu.status ?? 'active'))}`,
            description: menu.name,
            createdAt: isBurned ? menu.burned_at! : menu.created_at,
            linkPath: `disposable-menus`,
          });
        });
      }

      // Process deliveries
      if (deliveriesResult.status === 'fulfilled' && !deliveriesResult.value.error) {
        const deliveriesData = (deliveriesResult.value.data ?? []) as Array<{
          id: string;
          status?: string;
          created_at: string;
          order_id?: string;
        }>;
        deliveriesData.forEach((del) => {
          items.push({
            id: `delivery-${del.id}`,
            type: 'delivery',
            title: `Delivery ${formatStatus(String(del.status ?? 'assigned'))}`,
            description: `Order ${del.order_id?.slice(0, 8) ?? '...'}`,
            createdAt: del.created_at,
            linkPath: `fulfillment-hub`,
          });
        });
      }

      // Sort by createdAt DESC, take top 20
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items.slice(0, 20);
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a human-readable relative time string.
 * e.g. "2 minutes ago", "3 hours ago", "1 day ago"
 */
export function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
