import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, DollarSign, Package, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { playNotificationSound } from '@/utils/notificationSound';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  delivery_address: string;
  created_at: string;
  status?: string;
  courier_id?: string;
}

export default function AvailableOrdersCard({ courierId, isOnline }: { courierId: string; isOnline: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setOrders([]);
      return;
    }

    fetchAvailableOrders();

    // Subscribe to new orders
    const channel = supabase
      .channel('available-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('New order available:', payload);
          setOrders((prev) => [payload.new as Order, ...prev]);
          playNotificationSound(true);
          
          // Show notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 New Order Available!', {
              body: `Order ${payload.new.order_number} - $${payload.new.total}`,
              icon: '/placeholder.svg',
              tag: `order-${payload.new.id}`
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: 'status=neq.pending'
        },
        (payload) => {
          // Remove order if it's been taken
          setOrders((prev) => prev.filter((o) => o.id !== payload.new.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline]);

  const fetchAvailableOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .is('courier_id', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          courier_id: courierId,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .is('courier_id', null); // Only if not already assigned

      if (error) throw error;

      toast({
        title: "Order Accepted!",
        description: "Navigate to pickup location",
      });

      // Remove from available orders
      setOrders((prev) => prev.filter((o) => o.id !== orderId));

    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Order Taken",
        description: "This order was just accepted by another courier",
        variant: "destructive"
      });
      fetchAvailableOrders();
    } finally {
      setAcceptingId(null);
    }
  };

  if (!isOnline) {
    return (
      <Card className="bg-card">
        <CardContent className="p-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Go online to see available orders</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-foreground">Available Orders</CardTitle>
          <Badge variant="outline" className="animate-pulse">
            {orders.length} available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No orders available right now</p>
            <p className="text-xs text-muted-foreground mt-1">You'll be notified when new orders come in</p>
          </div>
        ) : (
          <AnimatePresence>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="border border-border rounded-lg p-4 bg-card hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-foreground">Order #{order.order_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/30">
                    ${order.total_amount?.toFixed(2) || '0.00'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="truncate">{order.delivery_address || 'Address pending'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Waiting {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)} min
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleAccept(order.id)}
                  disabled={acceptingId === order.id}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  {acceptingId === order.id ? 'Accepting...' : 'Accept Order'}
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
