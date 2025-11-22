import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Truck, Clock, CheckCircle, Package } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { subscribeWithErrorTracking } from '@/utils/realtimeHelper';

interface LiveOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  user_id: string;
  courier_id?: string;
}

export default function LiveOrders() {
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLiveOrders();

    // Subscribe to real-time updates with proper validation and error tracking
    const channel = supabase
      .channel('live-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          // Validate payload structure before processing
          if (payload && typeof payload === 'object') {
            if (payload.new && typeof payload.new === 'object') {
              logger.info('Order update received', { component: 'LiveOrders', orderNumber: (payload.new as any)?.order_number });
              loadLiveOrders();
            } else if (payload.old && typeof payload.old === 'object') {
              // Handle DELETE events
              logger.info('Order deleted', { component: 'LiveOrders', orderId: (payload.old as any)?.id });
              loadLiveOrders();
            }
          }
        }
      );

    // Use error tracking helper for subscription
    subscribeWithErrorTracking(channel, {
      channelName: 'live-orders',
      onSubscribe: (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to live orders', { component: 'LiveOrders' });
        }
      },
      onError: (error) => {
        logger.error('Realtime error', error, { component: 'LiveOrders' });
        toast.error('Connection issue. Please refresh if orders stop updating.');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLiveOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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
          <h1 className="text-3xl font-bold">Live Orders</h1>
          <Badge variant="default" className="animate-pulse">Live</Badge>
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
                    <Badge variant="outline" className="capitalize">{order.status}</Badge>
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
