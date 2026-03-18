import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  CheckCircle,
  Navigation,
  Clock,
} from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_borough: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  courier_picked_up_at?: string | null;
  delivered_at: string | null;
  special_instructions: string | null;
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export default function CourierActiveOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadOrder();

    // Subscribe to order updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          loadOrder();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Order subscription error', { status, orderId, component: 'ActiveOrderPage' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadOrder is defined below; only run when orderId changes
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            price
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      setOrder(orderData);
    } catch (error) {
      logger.error('Failed to load order:', error);
      toast.error('Error', {
        description: 'Failed to load order details',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === 'picked_up') {
        updates.courier_picked_up_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updates.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Status Updated', {
        description: `Order marked as ${newStatus}`,
      });

      if (newStatus === 'delivered') {
        navigate('/courier/dashboard');
      }
    } catch (error) {
      logger.error('Failed to update status:', error);
      toast.error('Error', {
        description: 'Failed to update order status',
      });
    } finally {
      setUpdating(false);
    }
  };

  const openNavigation = () => {
    if (order) {
      const address = encodeURIComponent(order.delivery_address);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Order not found</p>
          <Button onClick={() => navigate('/courier/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')} aria-label="Back to courier dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Order #{order.order_number}</h1>
            <Badge variant="outline" className="mt-1">
              {order.status}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6 pb-40">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold">{order.customer_name}</p>
              <a
                href={`tel:${order.customer_phone}`}
                className="text-sm text-primary flex items-center gap-2 mt-1"
              >
                <Phone className="h-4 w-4" />
                {order.customer_phone}
              </a>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{order.delivery_address}</p>
                <p className="text-sm text-muted-foreground">{order.delivery_borough}</p>
              </div>
            </div>
            {order.special_instructions && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground">Special Instructions:</p>
                <p className="text-sm mt-1">{order.special_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="font-semibold">${item.price.toFixed(2)}</p>
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary">${order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Order Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSmartDate(order.created_at, { includeTime: true })}
                  </p>
                </div>
              </div>

              {order.accepted_at && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Accepted</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSmartDate(order.accepted_at, { includeTime: true })}
                    </p>
                  </div>
                </div>
              )}

              {order.courier_picked_up_at && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Picked Up</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSmartDate(order.courier_picked_up_at, { includeTime: true })}
                    </p>
                  </div>
                </div>
              )}

              {order.delivered_at && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Delivered</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSmartDate(order.delivered_at, { includeTime: true })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t space-y-3 z-40 safe-area-bottom shadow-lg">
          <Button onClick={openNavigation} className="w-full gap-2" size="lg">
            <Navigation className="h-5 w-5" />
            Navigate to Address
          </Button>

          {order.status === 'accepted' && (
            <Button
              onClick={() => updateOrderStatus('picked_up')}
              disabled={updating}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {updating ? 'Updating...' : 'Mark as Picked Up'}
            </Button>
          )}

          {order.status === 'picked_up' && (
            <Button
              onClick={() => updateOrderStatus('delivered')}
              disabled={updating}
              variant="default"
              className="w-full"
              size="lg"
            >
              {updating ? 'Updating...' : 'Mark as Delivered'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
