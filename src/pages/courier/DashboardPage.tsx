import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  Clock,
  TrendingUp,
  MapPin,
  Navigation,
  Power,
  Menu,
  LogOut,
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import CourierKeyboardShortcuts from '@/components/courier/CourierKeyboardShortcuts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_address: string;
  total_amount: number;
  created_at: string;
  status: string;
}

interface Stats {
  todayDeliveries: number;
  todayEarnings: number;
  avgDeliveryTime: number;
  completionRate: number;
}

export default function CourierDashboardPage() {
  const { courier, loading, isOnline, toggleOnlineStatus } = useCourier();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    todayDeliveries: 0,
    todayEarnings: 0,
    avgDeliveryTime: 0,
    completionRate: 100,
  });
  const [loadingOrders, setLoadingOrders] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (courier) {
      loadAvailableOrders();
      loadStats();

      // Subscribe to new orders
      const channel = supabase
        .channel('available-orders')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: 'status=eq.pending',
          },
          () => {
            loadAvailableOrders();
            toast({
              title: '🚀 New Order Available!',
              description: 'A new delivery order is waiting for you',
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [courier]);

  const loadAvailableOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .is('courier_id', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAvailableOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's deliveries and earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('courier_earnings')
        .select('total_earned')
        .eq('courier_id', courier?.id)
        .gte('created_at', today);

      if (earningsError) throw earningsError;

      const todayEarnings = earnings?.reduce((sum, e) => sum + parseFloat(e.total_earned.toString()), 0) || 0;
      const todayDeliveries = earnings?.length || 0;

      setStats({
        todayDeliveries,
        todayEarnings,
        avgDeliveryTime: 28, // TODO: Calculate from actual data
        completionRate: 98, // TODO: Calculate from actual data
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          courier_id: courier?.id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .is('courier_id', null);

      if (error) throw error;

      toast({
        title: 'Order Accepted!',
        description: 'Navigate to pickup location',
      });

      loadAvailableOrders();
      navigate(`/courier/order/${orderId}`);
    } catch (error: any) {
      toast({
        title: 'Failed to Accept Order',
        description: error.message || 'Order may have been taken by another courier',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/courier/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/courier/dashboard')}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/courier/earnings')}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Earnings
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate('/courier/history')}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    History
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold">Courier Dashboard</h1>
          </div>

          <Button
            onClick={toggleOnlineStatus}
            variant={isOnline ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            {isOnline ? 'Online' : 'Offline'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayDeliveries}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.todayEarnings.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Delivery Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDeliveryTime} min</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Available Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Available Orders</span>
              <Badge variant={isOnline ? 'default' : 'secondary'}>
                {isOnline ? 'Accepting Orders' : 'Offline'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <p className="text-muted-foreground text-center py-8">Loading orders...</p>
            ) : availableOrders.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No orders available</p>
                {!isOnline && (
                  <p className="text-sm text-muted-foreground">
                    Go online to start receiving orders
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order) => (
                  <Card key={order.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Order #{order.order_number}</h3>
                            <Badge variant="outline">{order.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{order.delivery_address}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-semibold text-primary">
                              ${order.total_amount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDistance(new Date(order.created_at), new Date(), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={!isOnline}
                          className="gap-2"
                        >
                          <Navigation className="h-4 w-4" />
                          Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <CourierKeyboardShortcuts
        hasActiveOrder={false}
        hasPendingOrder={availableOrders.length > 0}
        onAcceptOrder={() => availableOrders[0] && handleAcceptOrder(availableOrders[0].id)}
        onToggleOnline={toggleOnlineStatus}
        onViewEarnings={() => navigate('/courier/earnings')}
      />
    </div>
  );
}
