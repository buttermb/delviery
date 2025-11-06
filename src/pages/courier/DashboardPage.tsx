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
  MapPin,
  Navigation,
  Menu,
  LogOut,
  DollarSign,
  Clock,
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import CourierKeyboardShortcuts from '@/components/courier/CourierKeyboardShortcuts';
import OnlineStatusCard from '@/components/courier/OnlineStatusCard';
import QuickStatsCard from '@/components/courier/QuickStatsCard';
import AvailableOrderCard from '@/components/courier/AvailableOrderCard';
import { UnifiedDeliveryView } from '@/components/courier/UnifiedDeliveryView';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { AnimatePresence } from 'framer-motion';
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
  const { courier, loading, isOnline, toggleOnlineStatus, role } = useCourier();
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

      // Subscribe to new orders - RLS will automatically filter by tenant
      const channel = supabase
        .channel('available-orders')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            // Only show notification if order is actually available (RLS filtered)
            if (payload.new.status === 'pending' && !payload.new.courier_id) {
              loadAvailableOrders();
              toast({
                title: '🚀 New Order Available!',
                description: 'A new delivery order is waiting for you',
              });
            }
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
      // RLS policies will automatically filter orders by courier's tenant_id
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

  // Enable order notifications when online (after function definitions)
  useOrderNotifications(isOnline, loadAvailableOrders);

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
            <div>
              <h1 className="text-lg font-semibold">Courier Dashboard</h1>
              {courier && (
                <p className="text-xs text-muted-foreground">{courier.full_name}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {/* Online Status */}
        <OnlineStatusCard />

        {/* Stats Grid */}
        <QuickStatsCard
          todayDeliveries={stats.todayDeliveries}
          todayEarnings={stats.todayEarnings}
          avgDeliveryTime={stats.avgDeliveryTime}
          completionRate={stats.completionRate}
        />

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
                <AnimatePresence mode="popLayout">
                  {availableOrders.map((order) => (
                    <AvailableOrderCard
                      key={order.id}
                      order={order}
                      onAccept={handleAcceptOrder}
                      disabled={!isOnline}
                    />
                  ))}
                </AnimatePresence>
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
