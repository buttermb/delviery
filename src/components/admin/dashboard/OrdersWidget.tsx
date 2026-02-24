/**
 * Orders Widget - Displays last 10 orders with status badges
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Truck from "lucide-react/dist/esm/icons/truck";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Package from "lucide-react/dist/esm/icons/package";
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

interface OrderRow {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_source?: string;
  user?: {
    full_name: string | null;
    email: string | null;
  };
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface StatusConfig {
  variant: BadgeVariant;
  icon: typeof Clock;
  className: string;
}

const statusConfig: Record<string, StatusConfig> = {
  pending: {
    variant: 'secondary',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  },
  confirmed: {
    variant: 'default',
    icon: CheckCircle,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  preparing: {
    variant: 'default',
    icon: Package,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  },
  ready: {
    variant: 'default',
    icon: CheckCircle,
    className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  },
  in_transit: {
    variant: 'default',
    icon: Truck,
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  },
  delivered: {
    variant: 'outline',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  cancelled: {
    variant: 'destructive',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] || {
    variant: 'secondary' as BadgeVariant,
    icon: Clock,
    className: '',
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`capitalize gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {status.replace('_', ' ')}
    </Badge>
  );
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case 'delivered':
    case 'completed':
      return 'bg-green-500';
    case 'in_transit':
    case 'ready':
      return 'bg-blue-500';
    case 'preparing':
    case 'confirmed':
      return 'bg-purple-500';
    case 'pending':
      return 'bg-yellow-500';
    case 'cancelled':
      return 'bg-red-500';
    default:
      return 'bg-muted';
  }
}

export function OrdersWidget() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: [...queryKeys.orders.lists(), 'widget', tenant?.id],
    queryFn: async (): Promise<OrderRow[]> => {
      if (!tenant?.id) return [];

      // Fetch recent orders from the orders table (cast to any to bypass deep type issues)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, status, created_at, customer_name')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map orders to expected format
      return (ordersData || []).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        user: order.customer_name ? { full_name: order.customer_name, email: null } : undefined,
      })) as OrderRow[];
    },
    enabled: !!tenant?.id,
    staleTime: 10000,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Recent Orders
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('orders')}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))
        ) : orders && orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => navigate(`orders?order=${order.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`orders?order=${order.id}`); } }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(order.status)}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    #{order.order_number || order.id.slice(0, 8)}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {order.user?.full_name || 'Customer'} • {format(new Date(order.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="font-semibold text-right">
                  ${Number(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent orders</p>
          </div>
        )}
      </div>
    </Card>
  );
}
