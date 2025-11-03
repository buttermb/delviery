import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Activity, DollarSign, ShoppingBag, Users, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RealtimeMetrics {
  todayRevenue: number;
  todayOrders: number;
  activeCustomers: number;
  pendingDeliveries: number;
  connectionStatus: 'connected' | 'disconnected';
}

interface LiveOrder {
  id: string;
  order_number?: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer_name?: string;
}

export default function RealtimeDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics>({
    todayRevenue: 0,
    todayOrders: 0,
    activeCustomers: 0,
    pendingDeliveries: 0,
    connectionStatus: 'disconnected',
  });

  // Initial data fetch
  const { data: initialData } = useQuery({
    queryKey: ['realtime-initial', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, order_number, customers(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      const revenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      // Get pending deliveries
      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .limit(100);

      return {
        orders: orders || [],
        revenue,
        pendingDeliveries: deliveries?.length || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Fallback refresh every 30 seconds
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    setConnectionStatus('connected');
    setRealtimeMetrics((prev) => ({ ...prev, connectionStatus: 'connected' }));

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newOrder = payload.new as any;
          setLiveOrders((prev) => [
            {
              id: newOrder.id,
              order_number: newOrder.order_number,
              total_amount: Number(newOrder.total_amount || 0),
              status: newOrder.status,
              created_at: newOrder.created_at,
              customer_name: newOrder.customer_name,
            },
            ...prev.slice(0, 9), // Keep last 10
          ]);

          // Update metrics
          setRealtimeMetrics((prev) => ({
            ...prev,
            todayOrders: prev.todayOrders + 1,
            todayRevenue: prev.todayRevenue + Number(newOrder.total_amount || 0),
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          // Handle order updates
          const updatedOrder = payload.new as any;
          setLiveOrders((prev) =>
            prev.map((order) =>
              order.id === updatedOrder.id
                ? {
                    ...order,
                    status: updatedOrder.status,
                    total_amount: Number(updatedOrder.total_amount || 0),
                  }
                : order
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
        }
      });

    // Load initial recent orders
    if (initialData?.orders) {
      setLiveOrders(
        initialData.orders.slice(0, 10).map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          total_amount: Number(order.total_amount || 0),
          status: order.status,
          created_at: order.created_at,
          customer_name: order.customers
            ? `${order.customers.first_name} ${order.customers.last_name}`
            : undefined,
        }))
      );
      setRealtimeMetrics({
        todayRevenue: initialData.revenue,
        todayOrders: initialData.orders.length,
        activeCustomers: 0, // Would need separate query
        pendingDeliveries: initialData.pendingDeliveries,
        connectionStatus: 'connected',
      });
    }

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [tenantId, initialData]);

  // Revenue timeline data (last hour)
  const revenueTimeline = liveOrders
    .slice()
    .reverse()
    .reduce((acc: Record<string, number>, order) => {
      const time = new Date(order.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      acc[time] = (acc[time] || 0) + order.total_amount;
      return acc;
    }, {});

  const timelineData = Object.entries(revenueTimeline)
    .map(([time, revenue]) => ({ time, revenue }))
    .slice(-20); // Last 20 data points

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Dashboard</h1>
          <p className="text-muted-foreground">Live updates of your business metrics</p>
        </div>
        <Badge
          variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
          className="flex items-center gap-2"
        >
          {connectionStatus === 'connected' ? (
            <>
              <Wifi className="h-4 w-4" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      {/* Real-Time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${realtimeMetrics.todayRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Live updates</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Today's Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeMetrics.todayOrders}</div>
            <div className="text-xs text-muted-foreground mt-1">Live updates</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeMetrics.activeCustomers}</div>
            <div className="text-xs text-muted-foreground mt-1">Last hour</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Pending Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeMetrics.pendingDeliveries}</div>
            <div className="text-xs text-muted-foreground mt-1">In progress</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Orders Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500 animate-pulse" />
              Live Orders Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {liveOrders.length > 0 ? (
                liveOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50 animate-fade-in"
                  >
                    <div>
                      <div className="font-medium">
                        Order {order.order_number || order.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.customer_name || 'Customer'} • {new Date(order.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">${order.total_amount.toFixed(2)}</div>
                      <Badge variant="outline" className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Waiting for new orders...</p>
                  <p className="text-xs">Orders will appear here in real-time</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Real-Time Revenue (Last Hour)</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#00C49F"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-300 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Revenue data will appear here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Realtime Connection</div>
                <div className="font-medium">
                  {connectionStatus === 'connected' ? 'Active' : 'Inactive'}
                </div>
              </div>
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' ? 'Live' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Update Frequency</div>
                <div className="font-medium">Real-time</div>
              </div>
              <Badge variant="outline">Instant</Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Data Refresh</div>
                <div className="font-medium">Auto</div>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

