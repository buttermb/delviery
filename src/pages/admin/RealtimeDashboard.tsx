import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ShoppingCart, DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface LiveOrder {
  id: string;
  created_at: string;
  total: number;
  status: string;
}

export default function RealtimeDashboard() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.realtimeDashboard.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const [ordersResult, customersResult] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['pending', 'confirmed', 'preparing', 'in_transit'])
            .limit(50),
          supabase
            .from('customers')
            .select('*')
            .eq('tenant_id', tenantId)
            .limit(1),
        ]);

        const orders = ordersResult.error && ordersResult.error.code === '42P01' ? [] : ordersResult.data ?? [];
        const customers = customersResult.error && customersResult.error.code === '42P01' ? [] : customersResult.data ?? [];

        const totalRevenue = orders.reduce((sum: number, o) => sum + parseFloat(String(o.total ?? 0)), 0);

        return {
          activeOrders: orders.length,
          totalRevenue,
          totalCustomers: customers.length,
          avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        };
      } catch (error) {
        logger.error('Error loading realtime dashboard stats', error, { component: 'RealtimeDashboard' });
        return null;
      }
    },
    enabled: !!tenantId,
    // Rely on realtime subscription below for live updates instead of polling
  });

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`realtime-dashboard-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            setLiveOrders((prev) => {
              const newOrder = payload.new as LiveOrder;
              const exists = prev.find((o) => o.id === newOrder.id);
              if (exists) {
                return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
              }
              return [newOrder, ...prev].slice(0, 10); // Add new to top
            });
            // Invalidate stats query so it refetches on realtime changes (replaces polling)
            queryClient.invalidateQueries({ queryKey: ['realtime-dashboard', tenantId] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', { component: 'RealtimeDashboard' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <EnhancedLoadingState variant="card" count={4} />
      </div>
    );
  }

  const statItems = [
    {
      title: "Active Orders",
      value: stats?.activeOrders ?? 0,
      sub: "Real-time count",
      icon: ShoppingCart,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      sub: "Today",
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Customers",
      value: stats?.totalCustomers ?? 0,
      sub: "Total",
      icon: Users,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      title: "Avg Order",
      value: formatCurrency(stats?.avgOrderValue ?? 0),
      sub: "Average value",
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    }
  ];

  return (
    <div className="p-4 sm:p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-500 animate-pulse" />
            Realtime Dashboard
          </h1>
          <p className="text-muted-foreground">Live updates and real-time metrics</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Live
        </Badge>
      </div>

      {/* Mobile Stats Carousel */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory hide-scrollbar">
        {statItems.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="min-w-[240px] sm:min-w-0 snap-center"
          >
            <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("p-2 rounded-full", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Live Orders
            <Badge variant="secondary" className="ml-2 text-xs">
              {liveOrders.length} Recent
            </Badge>
          </CardTitle>
          <CardDescription>Orders updated in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          {liveOrders.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {liveOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3 sm:p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingBagIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-bold text-sm sm:text-base">#{order.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-base font-bold">{formatCurrency(order.total ?? 0)}</div>
                        <Badge
                          variant={order.status === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 h-5"
                        >
                          {order.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EnhancedEmptyState
              type="generic"
              compact
              icon={ShoppingCart}
              title="No Live Orders"
              description="New orders will appear here in real-time as they're placed."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

