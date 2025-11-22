import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ShoppingCart, DollarSign, Users, TrendingUp } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { BetterEmptyState } from '@/components/BetterEmptyState';

interface LiveOrder {
  id: string;
  created_at: string;
  total: number;
  status: string;
}

export default function RealtimeDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['realtime-dashboard', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const [ordersResult, customersResult] = await Promise.all([
          supabase
            .from('orders' as any)
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
            .limit(50),
          supabase
            .from('customers' as any)
            .select('*')
            .eq('tenant_id', tenantId)
            .limit(1),
        ]);

        const orders = ordersResult.error && ordersResult.error.code === '42P01' ? [] : ordersResult.data || [];
        const customers = customersResult.error && customersResult.error.code === '42P01' ? [] : customersResult.data || [];

        const totalRevenue = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total || 0), 0);

        return {
          activeOrders: orders.length,
          totalRevenue,
          totalCustomers: customers.length,
          avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        };
      } catch (error) {
        logger.error('Error loading realtime dashboard stats', error, { component: 'RealtimeDashboard' });
        return null;
      }
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('realtime-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            setLiveOrders((prev) => {
              const newOrder = payload.new as LiveOrder;
              const exists = prev.find((o) => o.id === newOrder.id);
              if (exists) {
                return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
              }
              return [...prev, newOrder].slice(0, 10);
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', { component: 'RealtimeDashboard' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime subscription error', null, { component: 'RealtimeDashboard' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['realtime-dashboard', tenantId] });
        } else if (status === 'TIMED_OUT') {
          logger.error('Realtime subscription timed out', null, { component: 'RealtimeDashboard' });
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['realtime-dashboard', tenantId] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <EnhancedLoadingState variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-500 animate-pulse" />
            Realtime Dashboard
          </h1>
          <p className="text-muted-foreground">Live updates and real-time metrics</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700">
          <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeOrders || 0}</div>
            <p className="text-xs text-muted-foreground">Real-time count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.totalRevenue || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats?.avgOrderValue || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Average value</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Orders</CardTitle>
          <CardDescription>Orders updated in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          {liveOrders.length > 0 ? (
            <div className="space-y-2">
              {liveOrders.map((order: LiveOrder) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Order #{order.id.slice(0, 8)}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold">${(order.total || 0).toFixed(2)}</div>
                    <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                      {order.status || 'pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BetterEmptyState
              icon={ShoppingCart}
              title="No Live Orders"
              description="New orders will appear here in real-time as they're placed."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

