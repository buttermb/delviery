import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  delivery_address: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  cancelled_at?: string | null;
  tip_amount: number | null;
}

type StatusFilter = 'all' | 'delivered' | 'cancelled';

export default function CourierHistoryPage() {
  const { courier } = useCourier();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (courier) {
      loadOrders();
    }
  }, [courier, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courier?.id)
        .order('created_at', { ascending: false });

      if (statusFilter === 'delivered') {
        query = query.eq('status', 'delivered');
      } else if (statusFilter === 'cancelled') {
        query = query.eq('status', 'cancelled');
      } else {
        query = query.in('status', ['delivered', 'cancelled']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const counts = {
    all: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Delivery History</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Status Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Delivered ({counts.delivered})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({counts.cancelled})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading history...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {statusFilter === 'all'
                    ? 'No delivery history yet'
                    : `No ${statusFilter} deliveries`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">Order #{order.order_number}</h3>
                              <Badge variant={getStatusBadgeVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary">
                              ${order.total_amount.toFixed(2)}
                            </div>
                            {order.tip_amount && order.tip_amount > 0 && (
                              <div className="text-sm text-green-600">
                                +${order.tip_amount.toFixed(2)} tip
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{order.delivery_address}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                          <span>
                            {order.status === 'delivered' && order.delivered_at
                              ? format(new Date(order.delivered_at), 'MMM dd, yyyy h:mm a')
                              : order.status === 'cancelled' && order.cancelled_at
                              ? format(new Date(order.cancelled_at), 'MMM dd, yyyy h:mm a')
                              : format(new Date(order.created_at), 'MMM dd, yyyy h:mm a')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/courier/order/${order.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
