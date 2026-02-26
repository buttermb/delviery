/**
 * Pending Transfers Widget
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, ArrowRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { queryKeys } from '@/lib/queryKeys';

export function PendingTransfersWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { account } = useAccount();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: transfers, isLoading } = useQuery({
    queryKey: queryKeys.dashboardWidgets.pendingTransfers(account?.id),
    queryFn: async () => {
      if (!account?.id) return [];

      interface Transfer {
        id: string;
        status: string;
        scheduled_pickup_time: string | null;
        total_weight: number | null;
        total_value: number | null;
        orders?: {
          order_number: string;
          wholesale_clients?: { business_name: string } | null;
        } | null;
      }

      const { data } = await supabase
        .from('wholesale_deliveries')
        .select(`
          id,
          status,
          scheduled_pickup_time,
          total_weight,
          total_value,
          orders:wholesale_orders(
            order_number,
            wholesale_clients(business_name)
          )
        `)
        .eq('account_id', account.id)
        .in('status', ['scheduled', 'assigned'])
        .order('scheduled_pickup_time', { ascending: true })
        .limit(5);

      return (data ?? []) as Transfer[];
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Pending Transfers
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getFullPath('/admin/inventory/dispatch'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))
        ) : transfers && transfers.length > 0 ? (
          transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => navigate(getFullPath(`/admin/inventory/dispatch?transfer=${transfer.id}`))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(getFullPath(`/admin/inventory/dispatch?transfer=${transfer.id}`)); } }}
            >
              <div className="flex-1">
                <div className="font-medium">
                  #{transfer.orders?.order_number || transfer.id.slice(0, 8)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {transfer.orders?.wholesale_clients?.business_name || 'Transfer'}
                </div>
                {transfer.scheduled_pickup_time && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(transfer.scheduled_pickup_time), 'MMM d, h:mm a')}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className="capitalize">
                  {transfer.status}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {Number(transfer.total_weight || 0).toFixed(1)} lbs
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pending transfers</p>
          </div>
        )}
      </div>
    </Card>
  );
}

