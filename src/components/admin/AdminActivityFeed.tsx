import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Package, ShoppingCart, Users, Settings, FileText } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  type: 'order' | 'product' | 'customer' | 'setting' | 'invoice';
  action: string;
  actorName: string;
  timestamp: string;
  details?: string;
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'order':
      return <ShoppingCart className="h-4 w-4 text-blue-600" />;
    case 'product':
      return <Package className="h-4 w-4 text-emerald-600" />;
    case 'customer':
      return <Users className="h-4 w-4 text-purple-600" />;
    case 'setting':
      return <Settings className="h-4 w-4 text-gray-600" />;
    case 'invoice':
      return <FileText className="h-4 w-4 text-yellow-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

export function AdminActivityFeed() {
  const { tenantId, isReady } = useTenantContext();

  const { data: activities, isLoading } = useQuery({
    queryKey: queryKeys.admin.activityFeed(tenantId ?? ''),
    queryFn: async (): Promise<ActivityItem[]> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.info('[ActivityFeed] Fetching recent activity', { tenantId });

      // Fetch recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, status, customer_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent products
      const { data: products } = await supabase
        .from('products')
        .select('id, created_at, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, created_at, full_name, email')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);

      const activityItems: ActivityItem[] = [];

      // Add order activities
      if (orders) {
        orders.forEach((order) => {
          activityItems.push({
            id: `order-${order.id}`,
            type: 'order',
            action: `Created order`,
            actorName: 'System',
            timestamp: order.created_at,
            details: `Status: ${order.status}`,
          });
        });
      }

      // Add product activities
      if (products) {
        products.forEach((product) => {
          activityItems.push({
            id: `product-${product.id}`,
            type: 'product',
            action: `Added product`,
            actorName: 'Team',
            timestamp: product.created_at,
            details: product.name,
          });
        });
      }

      // Add customer activities
      if (customers) {
        customers.forEach((customer) => {
          activityItems.push({
            id: `customer-${customer.id}`,
            type: 'customer',
            action: `New customer signup`,
            actorName: customer.full_name ?? customer.email ?? 'Unknown',
            timestamp: customer.created_at,
          });
        });
      }

      // Sort by timestamp
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      logger.info('[ActivityFeed] Activity fetched', { count: activityItems.length });

      return activityItems.slice(0, 10);
    },
    enabled: isReady && !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (!isReady || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
        <CardDescription>Team activity and updates</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {!activities || activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="mt-0.5 p-2 bg-gray-50 rounded-lg">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="text-gray-700">{activity.actorName}</span> {activity.action}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-600 mt-0.5">{activity.details}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
