/**
 * Live Orders Widget for Hotbox Dashboard
 *
 * Shows a compact real-time feed of active orders with status.
 * Uses the same data source as the full LiveOrders page but in a
 * dashboard-friendly format.
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
import {
import { queryKeys } from '@/lib/queryKeys';
  Activity,
  Clock,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react';

// Status configuration
const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: 'New',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: AlertCircle,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: Package,
  },
  processing: {
    label: 'Processing',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: Package,
  },
  preparing: {
    label: 'Preparing',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: Package,
  },
  ready_for_pickup: {
    label: 'Ready',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
  },
  in_transit: {
    label: 'In Transit',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: CheckCircle,
  },
};

interface LiveOrderItem {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_amount: number;
  source: 'app' | 'menu';
  menu_title?: string;
}

// Type for menu order response
interface MenuOrderRaw {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  synced_order_id: string | null;
  disposable_menus: {
    title: string;
  } | null;
}

export function LiveOrdersWidget() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  // Enable real-time sync for orders
  const { isActive: isConnected } = useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['orders', 'menu_orders'],
    enabled: !!tenant?.id,
  });

  // Fetch active orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: queryKeys.hotbox.liveOrders(tenant?.id),
    queryFn: async (): Promise<LiveOrderItem[]> => {
      if (!tenant?.id) return [];

      try {
        // Parallel fetch for speed
        const [ordersRes, menuOrdersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id, order_number, status, created_at, total_amount')
            .eq('tenant_id', tenant.id)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit'])
            .order('created_at', { ascending: false })
            .limit(10),

          supabase
            .from('menu_orders')
            .select(`
              id, created_at, status, total_amount, synced_order_id,
              disposable_menus (title)
            `)
            .eq('tenant_id', tenant.id)
            .in('status', ['pending', 'confirmed', 'processing', 'preparing', 'ready_for_pickup', 'in_transit'])
            .is('synced_order_id', null)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (menuOrdersRes.error) throw menuOrdersRes.error;

        // Transform regular orders
        const normOrders: LiveOrderItem[] = (ordersRes.data || []).map(o => ({
          id: o.id,
          order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
          status: o.status,
          created_at: o.created_at,
          total_amount: Number(o.total_amount || 0),
          source: 'app' as const,
        }));

        // Transform menu orders
        const normMenuOrders: LiveOrderItem[] = ((menuOrdersRes.data as unknown as MenuOrderRaw[]) || []).map((mo) => ({
          id: mo.id,
          order_number: 'MENU-' + mo.id.slice(0, 5).toUpperCase(),
          status: mo.status === 'completed' ? 'delivered' : mo.status,
          created_at: mo.created_at,
          total_amount: Number(mo.total_amount || 0),
          source: 'menu' as const,
          menu_title: mo.disposable_menus?.title,
        }));

        // Combine and sort
        return [...normOrders, ...normMenuOrders]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8); // Show max 8 orders in widget

      } catch (err) {
        logger.error('Failed to fetch live orders for widget', err);
        return [];
      }
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Fallback poll every 30s
    staleTime: 10 * 1000,
  });

  // Group orders by status for summary
  const statusSummary = useMemo(() => {
    const summary = {
      new: 0,
      preparing: 0,
      ready: 0,
      transit: 0,
    };

    orders.forEach(order => {
      if (order.status === 'pending') summary.new++;
      else if (['confirmed', 'processing', 'preparing'].includes(order.status)) summary.preparing++;
      else if (order.status === 'ready_for_pickup') summary.ready++;
      else if (order.status === 'in_transit') summary.transit++;
    });

    return summary;
  }, [orders]);

  const handleViewAll = () => {
    navigate(`/${tenantSlug}/admin/live-orders`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            LIVE ORDERS
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
            <Activity className="h-5 w-5 text-green-500" />
            LIVE ORDERS
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
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
              {orders.length} active
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status summary pills */}
        <div className="flex flex-wrap gap-2">
          {statusSummary.new > 0 && (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              {statusSummary.new} New
            </Badge>
          )}
          {statusSummary.preparing > 0 && (
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200">
              <Package className="h-3 w-3 mr-1" />
              {statusSummary.preparing} Preparing
            </Badge>
          )}
          {statusSummary.ready > 0 && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              {statusSummary.ready} Ready
            </Badge>
          )}
          {statusSummary.transit > 0 && (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200">
              <Truck className="h-3 w-3 mr-1" />
              {statusSummary.transit} In Transit
            </Badge>
          )}
          {orders.length === 0 && (
            <span className="text-sm text-muted-foreground">No active orders</span>
          )}
        </div>

        {/* Order list */}
        {orders.length > 0 && (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => {
              const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('p-1.5 rounded', config.bgColor)}>
                      <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
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
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-sm">
                      ${order.total_amount.toFixed(2)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', config.color)}
                    >
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View all button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleViewAll}
        >
          View All Orders
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
