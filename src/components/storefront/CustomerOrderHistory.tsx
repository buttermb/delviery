import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { formatSmartDate } from '@/lib/formatters';
import { Package, ArrowRight } from 'lucide-react';

interface CustomerOrderHistoryProps {
  customerId: string;
  tenantSlug: string;
  onViewOrder?: (orderId: string) => void;
}

export function CustomerOrderHistory({ customerId, tenantSlug, onViewOrder }: CustomerOrderHistoryProps) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: queryKeys.orders.byCustomer(customerId, tenantSlug),
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, delivery_method')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId && !!tenantSlug,
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading order history...</div>;
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No orders yet</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      confirmed: 'default',
      delivered: 'default',
      cancelled: 'destructive',
    };
    return statusColors[status] || 'secondary';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Order History</h2>
      <div className="space-y-3">
        {orders.map((order: Record<string, unknown>) => (
          <Card key={order.id as string}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    Order #{order.order_number as string}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatSmartDate(order.created_at as string)}
                  </p>
                </div>
                <Badge variant={getStatusColor(order.status as string)}>
                  {order.status as string}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {formatCurrency(order.total as number)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {order.delivery_method as string || 'Pickup'}
                  </p>
                </div>
                {onViewOrder && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder(order.id as string)}
                  >
                    View
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
