// @ts-nocheck
/**
 * Recent Orders Widget
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';

export function RecentOrdersWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  
  const getFullPath = (path: string) => {
    if (!tenantSlug) return path;
    if (path.startsWith('/admin')) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };
  const { account } = useAccount();

  const { data: orders } = useQuery({
    queryKey: ['recent-orders-widget', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          wholesale_clients(business_name)
        `)
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(5);

      interface OrderRow {
        id: string;
        order_number: string;
        total_amount: number;
        status: string;
        created_at: string;
        wholesale_clients: { business_name: string } | null;
      }

      return (data || []) as OrderRow[];
    },
    enabled: !!account?.id,
    // Use real-time updates via useRealtimeSync instead of polling
    staleTime: 10000, // Allow 10s stale time for real-time updates
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'bg-green-500';
      case 'in_transit':
      case 'picked_up':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Orders
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getFullPath('/admin/wholesale-clients/new-order'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-3">
        {orders && orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(getFullPath(`/admin/wholesale-clients/new-order?order=${order.id}`))}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(order.status)}`} />
                <div>
                  <div className="font-medium">
                    #{order.order_number || order.id.slice(0, 8)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.wholesale_clients?.business_name || 'Client'} • {format(new Date(order.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold">
                  ${Number(order.total_amount || 0).toLocaleString()}
                </div>
                <Badge variant="outline" className="capitalize">
                  {order.status}
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No recent orders
          </div>
        )}
      </div>
    </Card>
  );
}

