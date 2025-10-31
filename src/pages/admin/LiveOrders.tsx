import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Truck, Clock, CheckCircle, Package } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

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
    
    // Subscribe to real-time updates
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
          // Validate payload before processing
          if (payload && payload.new) {
            console.log('[APP] Order update received:', payload);
            loadLiveOrders();
          }
        }
      )
      .subscribe((status) => {
        // Handle subscription status
        if (status === 'SUBSCRIBED') {
          console.log('[APP] Subscribed to live orders');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[APP] Channel error in live orders subscription');
          toast.error('Connection error. Retrying...');
        } else if (status === 'TIMED_OUT') {
          console.error('[APP] Channel timed out');
          toast.error('Connection timed out. Please refresh.');
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
    } catch (error: any) {
      console.error('Error loading live orders:', error);
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
