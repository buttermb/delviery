/**
 * Activity Feed Widget - Recent system activity
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle2, Package, User, Box } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface ActivityItem {
  id: string;
  type: 'order' | 'menu' | 'product' | 'customer';
  message: string;
  time: Date;
  icon: JSX.Element;
}

export function ActivityFeedWidget() {
  const { tenant } = useTenantAdminAuth();

  const { data: activities = [], isLoading, refetch } = useQuery<ActivityItem[]>({
    queryKey: queryKeys.dashboardWidgets.activityFeed(tenant?.id),
    queryFn: async (): Promise<ActivityItem[]> => {
      if (!tenant?.id) return [];

      const allActivities: ActivityItem[] = [];

      // Recent orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, status, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (ordersError) logger.error('Failed to fetch orders for activity feed', ordersError, { component: 'ActivityFeedWidget' });

      orders?.forEach((order) => {
        allActivities.push({
          id: order.id,
          type: 'order',
          message: `Order ${order.order_number} ${order.status}`,
          time: new Date(order.created_at),
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
      });

      // Recent menus
      const { data: menus, error: menusError } = await supabase
        .from('disposable_menus')
        .select('id, name, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (menusError) logger.error('Failed to fetch menus for activity feed', menusError, { component: 'ActivityFeedWidget' });

      menus?.forEach((menu) => {
        allActivities.push({
          id: menu.id,
          type: 'menu',
          message: `New menu created: ${menu.name}`,
          time: new Date(menu.created_at),
          icon: <Package className="h-4 w-4 text-info" />,
        });
      });

      // Recent products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (productsError) logger.error('Failed to fetch products for activity feed', productsError, { component: 'ActivityFeedWidget' });

      products?.forEach((product) => {
        allActivities.push({
          id: product.id,
          type: 'product',
          message: `Product added: ${product.name}`,
          time: new Date(product.created_at),
          icon: <Box className="h-4 w-4 text-purple-500" />,
        });
      });

      // Recent customers (simplified - basic fields only)
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, email, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (customersError) logger.error('Failed to fetch customers for activity feed', customersError, { component: 'ActivityFeedWidget' });

      customers?.forEach((customer) => {
        allActivities.push({
          id: customer.id,
          type: 'customer',
          message: `New customer: ${customer.email}`,
          time: new Date(customer.created_at),
          icon: <User className="h-4 w-4 text-orange-500" />,
        });
      });

      // Sort by time and take top 8
      return allActivities
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .slice(0, 8);
    },
    enabled: !!tenant?.id,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`activity-feed-${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenant.id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disposable_menus', filter: `tenant_id=eq.${tenant.id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `tenant_id=eq.${tenant.id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenant.id}` }, () => refetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity
        </h3>
        <Badge variant="outline">Live</Badge>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-2">
              <Skeleton className="h-4 w-4 mt-0.5 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5">{activity.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm line-clamp-2">{activity.message}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatTime(activity.time)}
              </div>
            </div>
          </div>
          ))
        )}
      </div>

      <button className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
        View All Activity →
      </button>
    </Card>
  );
}

