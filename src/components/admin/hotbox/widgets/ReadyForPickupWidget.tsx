/**
 * Ready For Pickup Widget for Hotbox Dashboard
 *
 * Shows orders that are ready for pickup, helping staff
 * quickly see which orders are waiting for customers.
 * Uses real-time sync for live updates.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import User from "lucide-react/dist/esm/icons/user";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import { queryKeys } from '@/lib/queryKeys';

interface PickupOrderItem {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  total_amount: number;
  source: 'app' | 'menu';
  customer_name: string | null;
  customer_phone: string | null;
  ready_since: string;
}

// Type for menu order response
interface MenuOrderRaw {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  disposable_menus: {
    title: string;
  } | null;
}

// Type for regular order response
interface OrderRaw {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  status: string;
  total_amount: number;
  customers: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

export function ReadyForPickupWidget() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  // Enable real-time sync for orders
  const { isActive: isConnected } = useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['orders', 'menu_orders'],
    enabled: !!tenant?.id,
  });

  // Fetch orders ready for pickup
  const { data: orders = [], isLoading } = useQuery({
    queryKey: queryKeys.hotbox.readyForPickup(tenant?.id),
    queryFn: async (): Promise<PickupOrderItem[]> => {
      if (!tenant?.id) return [];

      try {
        // Parallel fetch for speed
        const [ordersRes, menuOrdersRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`
              id, order_number, status, created_at, updated_at, total_amount,
              customers (first_name, last_name, phone)
            `)
            .eq('tenant_id', tenant.id)
            .eq('status', 'ready_for_pickup')
            .order('updated_at', { ascending: true })
            .limit(10),

          supabase
            .from('menu_orders')
            .select(`
              id, created_at, updated_at, status, total_amount,
              customer_name, customer_phone,
              disposable_menus (title)
            `)
            .eq('tenant_id', tenant.id)
            .eq('status', 'ready_for_pickup')
            .order('updated_at', { ascending: true })
            .limit(10),
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (menuOrdersRes.error) throw menuOrdersRes.error;

        // Transform regular orders
        const normOrders: PickupOrderItem[] = ((ordersRes.data as unknown as OrderRaw[]) || []).map(o => {
          const customer = o.customers;
          const customerName = customer
            ? [customer.first_name, customer.last_name].filter(Boolean).join(' ')
            : null;

          return {
            id: o.id,
            order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
            created_at: o.created_at,
            updated_at: o.updated_at,
            total_amount: Number(o.total_amount || 0),
            source: 'app' as const,
            customer_name: customerName || null,
            customer_phone: customer?.phone || null,
            ready_since: o.updated_at,
          };
        });

        // Transform menu orders
        const normMenuOrders: PickupOrderItem[] = ((menuOrdersRes.data as unknown as MenuOrderRaw[]) || []).map((mo) => ({
          id: mo.id,
          order_number: 'MENU-' + mo.id.slice(0, 5).toUpperCase(),
          created_at: mo.created_at,
          updated_at: mo.updated_at,
          total_amount: Number(mo.total_amount || 0),
          source: 'menu' as const,
          customer_name: mo.customer_name,
          customer_phone: mo.customer_phone,
          ready_since: mo.updated_at,
        }));

        // Combine and sort by ready time (oldest first - waiting longest)
        return [...normOrders, ...normMenuOrders]
          .sort((a, b) => new Date(a.ready_since).getTime() - new Date(b.ready_since).getTime())
          .slice(0, 8);

      } catch (err) {
        logger.error('Failed to fetch ready for pickup orders', err);
        return [];
      }
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Fallback poll every 30s
    staleTime: 10 * 1000,
  });

  // Calculate wait time categories
  const waitTimeStats = useMemo(() => {
    const stats = {
      urgent: 0, // > 30 min
      waiting: 0, // 15-30 min
      recent: 0, // < 15 min
    };

    const now = new Date();
    orders.forEach(order => {
      const readyTime = new Date(order.ready_since);
      const minutesWaiting = (now.getTime() - readyTime.getTime()) / (1000 * 60);

      if (minutesWaiting > 30) stats.urgent++;
      else if (minutesWaiting > 15) stats.waiting++;
      else stats.recent++;
    });

    return stats;
  }, [orders]);

  const handleViewAll = () => {
    navigate(`/${tenantSlug}/admin/live-orders?status=ready_for_pickup`);
  };

  const handleOrderClick = (orderId: string, source: 'app' | 'menu') => {
    if (source === 'menu') {
      navigate(`/${tenantSlug}/admin/orders?tab=menu&orderId=${orderId}`);
    } else {
      navigate(`/${tenantSlug}/admin/orders?orderId=${orderId}`);
    }
  };

  // Get wait time badge color
  const getWaitTimeBadge = (readySince: string) => {
    const now = new Date();
    const readyTime = new Date(readySince);
    const minutesWaiting = (now.getTime() - readyTime.getTime()) / (1000 * 60);

    if (minutesWaiting > 30) {
      return {
        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: 'Urgent',
      };
    }
    if (minutesWaiting > 15) {
      return {
        color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        label: 'Waiting',
      };
    }
    return {
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      label: 'Ready',
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            READY FOR PICKUP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Package className="h-5 w-5 text-green-500" />
            READY FOR PICKUP
            {orders.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                isConnected
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              )}
              title={isConnected ? 'Real-time connected' : 'Polling mode'}
            >
              {isConnected ? (
                <Wifi className="h-2.5 w-2.5" />
              ) : (
                <WifiOff className="h-2.5 w-2.5" />
              )}
              {isConnected ? 'Live' : 'Poll'}
            </div>
            <Badge variant="outline" className="text-xs">
              {orders.length} ready
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wait time summary badges */}
        {orders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {waitTimeStats.urgent > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200">
                <Clock className="h-3 w-3 mr-1" />
                {waitTimeStats.urgent} Urgent (&gt;30m)
              </Badge>
            )}
            {waitTimeStats.waiting > 0 && (
              <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200">
                <Clock className="h-3 w-3 mr-1" />
                {waitTimeStats.waiting} Waiting (15-30m)
              </Badge>
            )}
            {waitTimeStats.recent > 0 && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                {waitTimeStats.recent} Recent (&lt;15m)
              </Badge>
            )}
          </div>
        )}

        {/* Order list */}
        {orders.length > 0 ? (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => {
              const waitBadge = getWaitTimeBadge(order.ready_since);

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => handleOrderClick(order.id, order.source)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleOrderClick(order.id, order.source);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/30">
                      <Package className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">#{order.order_number}</span>
                        {order.source === 'menu' && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            Menu
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {order.customer_name ? (
                          <>
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{order.customer_name}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Ready {formatDistanceToNow(new Date(order.ready_since), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-sm">
                      ${order.total_amount.toFixed(2)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', waitBadge.color)}
                    >
                      {waitBadge.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
            <p className="text-sm">No orders waiting for pickup</p>
            <p className="text-xs">Orders will appear here when ready</p>
          </div>
        )}

        {/* View all button */}
        {orders.length > 0 && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleViewAll}
          >
            View All Pickup Orders
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
