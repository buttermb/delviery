import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Truck, Clock, CheckCircle, Package, RefreshCcw } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { subscribeWithErrorTracking } from '@/utils/realtimeHelper';
import { Button } from '@/components/ui/button';

interface LiveOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  user_id: string;
  courier_id?: string;
  source?: 'menu' | 'app';
  menu_title?: string;
}

interface MenuOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  synced_order_id: string | null;
  disposable_menus: {
    title: string;
  } | null;
}

export default function LiveOrders() {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLiveOrders();

    // Subscribe to BOTH orders AND menu_orders tables
    const ordersChannel = supabase
      .channel('live-orders-main')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        logger.info('Order update received', { component: 'LiveOrders' });
        loadLiveOrders();
      })
      .subscribe();

    const menuOrdersChannel = supabase
      .channel('live-menu-orders-secondary')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_orders'
      }, () => {
        logger.info('Menu Order update received', { component: 'LiveOrders' });
        loadLiveOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuOrdersChannel);
    };
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadLiveOrders();
    setRefreshing(false);
  };

  const loadLiveOrders = async () => {
    try {
      // Query BOTH tables and union results
      const [ordersResult, menuOrdersResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
          .order('created_at', { ascending: false }),

        supabase
          .from('menu_orders')
          .select(`
            id,
            created_at,
            status,
            total_amount,
            synced_order_id,
            disposable_menus (title)
          `)
          .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
          .order('created_at', { ascending: false })
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (menuOrdersResult.error) throw menuOrdersResult.error;

      const normalizedOrders = ordersResult.data || [];

      // Transform menu_orders but FILTER OUT those that are already synced 
      // (because they are present in normalizedOrders)
      // Use unknown cast first to avoid TS errors with Supabase types not matching local interface perfectly yet
      const rawMenuOrders = (menuOrdersResult.data || []) as unknown as MenuOrder[];

      const normalizedMenuOrders = rawMenuOrders
        .filter(mo => !mo.synced_order_id) // Only show unsynced/pending sync orders
        .map(mo => ({
          id: mo.id,
          order_number: 'MENU-' + mo.id.slice(0, 8).toUpperCase(),
          status: mo.status,
          created_at: mo.created_at,
          user_id: 'guest', // Placeholder
          source: 'menu' as const,
          menu_title: mo.disposable_menus?.title
        }));

      // Combine and sort
      const combined = [...normalizedOrders, ...normalizedMenuOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(combined as LiveOrder[]);
    } catch (error) {
      logger.error('Error loading live orders', error, { component: 'LiveOrders' });
      toast.error('Failed to load live orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'confirmed': return CheckCircle;
      case 'preparing': return Package;
      case 'in_transit': return Truck;
      default: return Package;
    }
  };

  return (
    <>
      <SEOHead
        title="Live Orders | Admin"
        description="Real-time order tracking"
      />

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Live Orders</h1>
            <Badge variant="default" className="animate-pulse">Live</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p>Loading live orders...</p>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No active orders at the moment</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const StatusIcon = getStatusIcon(order.status);
              return (
                <Card key={order.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold">#{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">Order</p>
                    </div>
                    <StatusIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{order.status}</Badge>
                      {order.source === 'menu' && (
                        <Badge variant="secondary" className="text-xs">
                          {order.menu_title || 'Disposable Menu'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
