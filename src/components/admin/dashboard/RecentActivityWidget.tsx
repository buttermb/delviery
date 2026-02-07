/**
 * Recent Activity Widget
 * Shows recent system activity and user actions
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { useNavigate, useParams } from 'react-router-dom';

interface ActivityItem {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  user_email?: string;
}

export function RecentActivityWidget() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: activities } = useQuery({
    queryKey: ['recent-activity', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      // Get recent orders, transfers, and inventory updates
      const [ordersResult, transfersResult] = await Promise.all([
        supabase
          .from('wholesale_orders')
          .select('id, order_number, status, created_at, tenant_id')
          .eq('tenant_id', account.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('wholesale_deliveries')
          .select('id, status, created_at, tenant_id')
          .eq('tenant_id', account.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      interface OrderRow {
        id: string;
        order_number: string;
        status: string;
        created_at: string;
        tenant_id: string;
      }

      interface TransferRow {
        id: string;
        status: string;
        created_at: string;
        tenant_id: string;
      }

      const activities: ActivityItem[] = [];

      // Add orders as activities
      (ordersResult.data || []).forEach((order: OrderRow) => {
        activities.push({
          id: order.id,
          action: `Order #${order.order_number} ${order.status}`,
          entity_type: 'order',
          entity_id: order.id,
          created_at: order.created_at,
        });
      });

      // Add transfers as activities
      (transfersResult.data || []).forEach((transfer: TransferRow) => {
        activities.push({
          id: transfer.id,
          action: `Transfer ${transfer.status}`,
          entity_type: 'transfer',
          entity_id: transfer.id,
          created_at: transfer.created_at,
        });
      });

      // Sort by date and take most recent 8
      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
    },
    enabled: !!account?.id,
    refetchInterval: 30000,
  });

  const getActionColor = (action: string) => {
    if (action.includes('completed') || action.includes('delivered')) {
      return 'bg-success/10 text-success';
    }
    if (action.includes('pending') || action.includes('scheduled')) {
      return 'bg-warning/10 text-warning';
    }
    return 'bg-info/10 text-info';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </h3>
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => {
                if (activity.entity_type === 'order') {
                  navigate(getFullPath(`/admin/big-plug-order?order=${activity.entity_id}`));
                } else if (activity.entity_type === 'transfer') {
                  navigate(getFullPath(`/admin/inventory/dispatch?transfer=${activity.entity_id}`));
                }
              }}
            >
              <div className="p-1.5 rounded-full bg-primary/10 mt-0.5">
                <Activity className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{activity.action}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${getActionColor(activity.action)}`}
                  >
                    {activity.entity_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(activity.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        </div>
      )}
    </Card>
  );
}

