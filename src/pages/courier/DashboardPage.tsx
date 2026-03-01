
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, DollarSign, Clock, Settings, Truck } from 'lucide-react';
import CourierKeyboardShortcuts from '@/components/courier/CourierKeyboardShortcuts';
import OnlineStatusCard from '@/components/courier/OnlineStatusCard';
import QuickStatsCard from '@/components/courier/QuickStatsCard';
import { UnifiedDeliveryView } from '@/components/courier/UnifiedDeliveryView';
import { RoleIndicator } from '@/components/courier/RoleIndicator';
import { LocationTrackingStatus } from '@/components/courier/LocationTrackingStatus';
import { useRunnerStats } from '@/hooks/useRunnerStats';
import { humanizeError } from '@/lib/humanizeError';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface Order {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  delivery_address: string;
  total_amount: number;
  created_at: string; // Created at is usually present, but type says null. We'll handle it.
  status: string;
  delivery_borough?: string | null;
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
  const [_loadingOrders, setLoadingOrders] = useState(true);
  const navigate = useNavigate();

  const { data: runnerStats } = useRunnerStats(role === 'runner' ? courier?.id : undefined);
  const [courierStats, setCourierStats] = useState<Stats>({
    todayDeliveries: 0,
    todayEarnings: 0,
    avgDeliveryTime: 0,
    completionRate: 100,
  });

  const stats = role === 'runner' && runnerStats ? runnerStats : courierStats;

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
            // Validate payload before using
            if (!payload?.new || typeof payload.new !== 'object') {
              logger.warn('Invalid order payload received', { component: 'CourierDashboard' });
              return;
            }

            // Only show notification if order is actually available (RLS filtered)
            if (payload.new.status === 'pending' && !payload.new.courier_id) {
              loadAvailableOrders();
              toast.success('New Order Available!', {
                description: 'A new delivery order is waiting for you',
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.error('Orders subscription error', { status, component: 'CourierDashboard' });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadStats is defined below; only run when courier changes
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
      setAvailableOrders(data ?? []);
    } catch (error) {
      logger.error('Failed to load orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadStats = async () => {
    if (role === 'courier') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: earnings, error } = await supabase
          .from('courier_earnings')
          .select('total_earned')
          .eq('courier_id', courier?.id)
          .gte('created_at', today);

        if (error) throw error;

        const todayEarnings = earnings?.reduce((sum, e) => sum + parseFloat(e.total_earned.toString()), 0) ?? 0;
        const todayDeliveries = earnings?.length ?? 0;

        setCourierStats({
          todayDeliveries,
          todayEarnings,
          avgDeliveryTime: 28,
          completionRate: 98,
        });
      } catch (error) {
        logger.error('Failed to load stats:', error);
      }
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

      toast.success('Order Accepted!', {
        description: 'Navigate to pickup location',
      });

      loadAvailableOrders();
      navigate(`/courier/order/${orderId}`);
    } catch (error: unknown) {
      toast.error('Failed to Accept Order', {
        description: humanizeError(error, 'Order may have been taken by another courier'),
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-area-top">
        <div className="w-full max-w-screen-2xl mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
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
                    <Truck className="mr-2 h-4 w-4" />
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
                    className="w-full justify-start"
                    onClick={() => navigate('/courier/settings')}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
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
              <h1 className="text-lg font-semibold">{courier?.full_name}</h1>
              <RoleIndicator role={role} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-screen-2xl mx-auto">
        {/* Online Status */}
        <OnlineStatusCard />

        {/* Location Tracking Status (when online) */}
        <LocationTrackingStatus />

        {/* Stats Grid */}
        <QuickStatsCard
          todayDeliveries={stats.todayDeliveries}
          todayEarnings={stats.todayEarnings}
          avgDeliveryTime={stats.avgDeliveryTime}
          completionRate={stats.completionRate}
        />

        {/* Unified Delivery View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{role === 'courier' ? 'Available Orders' : 'Delivery Assignments'}</span>
              <Badge variant={isOnline ? 'default' : 'secondary'}>
                {isOnline ? (role === 'courier' ? 'Accepting Orders' : 'Active') : 'Offline'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UnifiedDeliveryView
              courierOrders={availableOrders as unknown as React.ComponentProps<typeof UnifiedDeliveryView>['courierOrders']}
              onAcceptOrder={handleAcceptOrder}
              onCompleteDelivery={() => { }}
            />
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
