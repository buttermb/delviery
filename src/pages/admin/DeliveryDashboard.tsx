/**
 * Delivery Dashboard Page
 * Overview of all deliveries with stats, map, runner status, and assignments
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, differenceInMinutes, parseISO } from 'date-fns';
import {
  Truck,
  Clock,
  CheckCircle2,
  MapPin,
  Users,
  Timer,
  TrendingUp,
  Package,
  AlertCircle,
  RefreshCw,
  Navigation,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { formatPhoneNumber } from '@/lib/formatters';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SEOHead } from '@/components/SEOHead';
import { LeafletMapWidget } from '@/components/admin/dashboard/LeafletMapWidget';
import { useAvailableRunners } from '@/hooks/useAvailableRunners';
import { AssignRunnerDialog } from '@/components/admin/AssignRunnerDialog';
import { TruncatedText } from '@/components/shared/TruncatedText';

interface DeliveryOrder {
  id: string;
  status: string;
  delivery_address: string | null;
  delivery_scheduled_at: string | null;
  delivery_completed_at: string | null;
  courier_id: string | null;
  created_at: string;
  total_amount: number;
  customer_name: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  couriers: {
    full_name: string;
    phone: string;
  } | null;
}

interface DeliveryStats {
  activeDeliveries: number;
  completedToday: number;
  avgDeliveryTimeMinutes: number;
  onTimeRate: number;
  pendingAssignments: number;
  inTransit: number;
}

interface RunnerWithLoad {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  activeDeliveries: number;
}

interface TimelineEvent {
  id: string;
  orderId: string;
  status: string;
  timestamp: string;
  customerName: string | null;
  address: string | null;
}

export default function DeliveryDashboard() {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<{
    id: string;
    orderNumber: string;
    address: string;
  } | null>(null);

  // Fetch all delivery-related orders
  const { data: orders = [], isLoading: loadingOrders, refetch } = useQuery({
    queryKey: queryKeys.deliveries.list(tenant?.id, { dashboard: true }),
    queryFn: async (): Promise<DeliveryOrder[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          delivery_address,
          delivery_scheduled_at,
          courier_id,
          created_at,
          total_amount,
          customer_name,
          delivery_lat,
          delivery_lng,
          couriers(full_name, phone)
        `)
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed', 'out_for_delivery', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        logger.error('Error fetching delivery orders', error, { component: 'DeliveryDashboard' });
        throw error;
      }

      return (data ?? []) as unknown as DeliveryOrder[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch runners with current load
  const { data: runnersRaw = [], isLoading: loadingRunners } = useAvailableRunners({
    onlyAvailable: false,
  });

  // Calculate runner loads from orders
  const runners = useMemo((): RunnerWithLoad[] => {
    const courierLoadMap = new Map<string, number>();
    orders.forEach((order) => {
      if (order.courier_id && order.status === 'out_for_delivery') {
        courierLoadMap.set(order.courier_id, (courierLoadMap.get(order.courier_id) ?? 0) + 1);
      }
    });

    return runnersRaw.map((runner) => ({
      id: runner.id,
      full_name: runner.full_name,
      phone: runner.phone,
      vehicle_type: runner.vehicle_type,
      status: runner.status,
      current_lat: runner.current_lat,
      current_lng: runner.current_lng,
      activeDeliveries: courierLoadMap.get(runner.id) ?? 0,
    }));
  }, [runnersRaw, orders]);

  // Calculate stats
  const stats = useMemo((): DeliveryStats => {
    const todayOrders = orders.filter((o) =>
      o.created_at && isToday(parseISO(o.created_at))
    );

    const activeDeliveries = orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'out_for_delivery'
    ).length;

    const completedToday = todayOrders.filter((o) => o.status === 'delivered').length;

    const pendingAssignments = orders.filter(
      (o) => (o.status === 'pending' || o.status === 'confirmed') && !o.courier_id
    ).length;

    const inTransit = orders.filter((o) => o.status === 'out_for_delivery').length;

    // Calculate average delivery time for completed orders today
    const completedWithTimes = todayOrders.filter(
      (o) => o.status === 'delivered' && o.delivery_scheduled_at && o.delivery_completed_at
    );

    let avgDeliveryTimeMinutes = 0;
    if (completedWithTimes.length > 0) {
      const totalMinutes = completedWithTimes.reduce((sum, order) => {
        const scheduled = parseISO(order.delivery_scheduled_at!);
        const completed = parseISO(order.delivery_completed_at!);
        return sum + Math.abs(differenceInMinutes(completed, scheduled));
      }, 0);
      avgDeliveryTimeMinutes = Math.round(totalMinutes / completedWithTimes.length);
    }

    // Calculate on-time rate (delivered within 30 minutes of scheduled time)
    let onTimeRate = 100;
    if (completedWithTimes.length > 0) {
      const onTimeCount = completedWithTimes.filter((order) => {
        const scheduled = parseISO(order.delivery_scheduled_at!);
        const completed = parseISO(order.delivery_completed_at!);
        return differenceInMinutes(completed, scheduled) <= 30;
      }).length;
      onTimeRate = Math.round((onTimeCount / completedWithTimes.length) * 100);
    }

    return {
      activeDeliveries,
      completedToday,
      avgDeliveryTimeMinutes,
      onTimeRate,
      pendingAssignments,
      inTransit,
    };
  }, [orders]);

  // Build timeline events for today
  const timelineEvents = useMemo((): TimelineEvent[] => {
    return orders
      .filter((o) => o.created_at && isToday(parseISO(o.created_at)))
      .map((order) => ({
        id: order.id,
        orderId: order.id.slice(0, 8),
        status: order.status,
        timestamp: order.delivery_completed_at || order.created_at,
        customerName: order.customer_name,
        address: order.delivery_address,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [orders]);

  // Build map locations for active deliveries
  const mapLocations = useMemo(() => {
    const locations: Array<{
      name: string;
      lat: number;
      lng: number;
      type: 'warehouse' | 'runner' | 'delivery';
    }> = [];

    // Add active delivery locations
    orders
      .filter((o) => o.status === 'out_for_delivery' && o.delivery_lat && o.delivery_lng)
      .forEach((order) => {
        locations.push({
          name: order.customer_name || `Order #${order.id.slice(0, 8)}`,
          lat: order.delivery_lat!,
          lng: order.delivery_lng!,
          type: 'delivery',
        });
      });

    // Add runner locations
    runners
      .filter((r) => r.status === 'available' && r.current_lat && r.current_lng)
      .forEach((runner) => {
        locations.push({
          name: runner.full_name,
          lat: runner.current_lat!,
          lng: runner.current_lng!,
          type: 'runner',
        });
      });

    return locations;
  }, [orders, runners]);

  // Pending assignments queue
  const pendingQueue = useMemo(() => {
    return orders
      .filter((o) => (o.status === 'pending' || o.status === 'confirmed') && !o.courier_id)
      .slice(0, 10);
  }, [orders]);

  const handleQuickAssign = (order: DeliveryOrder) => {
    setSelectedOrderForAssign({
      id: order.id,
      orderNumber: order.id.slice(0, 8),
      address: order.delivery_address || 'No address',
    });
    setAssignDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'out_for_delivery':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'delivered':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRunnerStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500/10 text-green-600';
      case 'busy':
        return 'bg-amber-500/10 text-amber-600';
      case 'offline':
        return 'bg-gray-500/10 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const isLoading = loadingOrders || loadingRunners;

  return (
    <div className="min-h-dvh bg-background p-4">
      <SEOHead
        title="Delivery Dashboard | Admin"
        description="Overview of all deliveries, runners, and assignments"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Delivery Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time overview of deliveries and runner operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={() => navigateToAdmin('delivery-management')}>
            <Truck className="w-4 h-4 mr-2" />
            Manage Deliveries
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.activeDeliveries}</p>
                )}
                <p className="text-xs text-muted-foreground">Active Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.completedToday}</p>
                )}
                <p className="text-xs text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Timer className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">
                    {stats.avgDeliveryTimeMinutes > 0 ? `${stats.avgDeliveryTimeMinutes}m` : '-'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Avg Delivery Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.onTimeRate}%</p>
                )}
                <p className="text-xs text-muted-foreground">On-Time Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.pendingAssignments}</p>
                )}
                <p className="text-xs text-muted-foreground">Pending Assign</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Navigation className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className="text-2xl font-bold">{stats.inTransit}</p>
                )}
                <p className="text-xs text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Active Delivery Locations
              </CardTitle>
              <CardDescription>
                Live view of runners and pending deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="w-full h-[400px] rounded-lg" />
              ) : (
                <LeafletMapWidget locations={mapLocations} zoom={11} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Runner Status List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Runner Status
            </CardTitle>
            <CardDescription>
              Current status and load of all runners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : runners.length > 0 ? (
                <div className="space-y-3">
                  {runners.map((runner) => (
                    <div
                      key={runner.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <TruncatedText text={runner.full_name} className="font-medium" as="p" />
                        <p className="text-xs text-muted-foreground">
                          {runner.vehicle_type} • {formatPhoneNumber(runner.phone)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getRunnerStatusColor(runner.status)}>
                          {runner.status}
                        </Badge>
                        {runner.activeDeliveries > 0 && (
                          <Badge variant="secondary">
                            {runner.activeDeliveries} active
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No runners available</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Pending Queue + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Pending Assignments Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pending Assignments
            </CardTitle>
            <CardDescription>
              Orders waiting for runner assignment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : pendingQueue.length > 0 ? (
                <div className="space-y-3">
                  {pendingQueue.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-medium">
                            #{order.id.slice(0, 8)}
                          </span>
                          <Badge variant="outline" className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <TruncatedText text={order.delivery_address || 'No address'} className="text-sm text-muted-foreground" as="p" />
                        <p className="text-xs text-muted-foreground mt-1">
                          ${order.total_amount?.toFixed(2) || '0.00'}
                          {order.delivery_scheduled_at && (
                            <> • Scheduled: {format(parseISO(order.delivery_scheduled_at), 'h:mm a')}</>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleQuickAssign(order)}
                      >
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-green-500" />
                  <p className="text-sm">All orders are assigned</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Delivery Timeline for Today */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Timeline
            </CardTitle>
            <CardDescription>
              Recent delivery activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : timelineEvents.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {timelineEvents.map((event) => (
                      <div key={event.id} className="relative flex gap-4 pl-8">
                        <div
                          className={cn(
                            'absolute left-0 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center',
                            event.status === 'delivered'
                              ? 'bg-green-500'
                              : event.status === 'out_for_delivery'
                              ? 'bg-purple-500'
                              : 'bg-amber-500'
                          )}
                        >
                          {event.status === 'delivered' ? (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          ) : event.status === 'out_for_delivery' ? (
                            <Truck className="h-3 w-3 text-white" />
                          ) : (
                            <Clock className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-medium">
                              #{event.orderId}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(event.timestamp), 'h:mm a')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">
                            {event.status.replace('_', ' ')}
                            {event.customerName && ` • ${event.customerName}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No activity today</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      {selectedOrderForAssign && (
        <AssignRunnerDialog
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open);
            if (!open) {
              setSelectedOrderForAssign(null);
              refetch();
            }
          }}
          orderId={selectedOrderForAssign.id}
          orderNumber={selectedOrderForAssign.orderNumber}
        />
      )}
    </div>
  );
}
