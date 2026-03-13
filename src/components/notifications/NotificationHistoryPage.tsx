import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

import type { NotificationDeliveryLog, NotificationType } from '@/types/notifications/notification';

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  order_status_change: 'Order Status',
  low_stock_alert: 'Low Stock',
  delivery_alert: 'Delivery',
  payment_received: 'Payment',
  driver_status_change: 'Driver Status',
  expiring_menu: 'Expiring Menu',
  new_customer_signup: 'New Customer',
  system_maintenance: 'System',
  invoice_overdue: 'Invoice',
  team_member_mention: 'Mention',
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'sent':
      return <Clock className="h-4 w-4 text-blue-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'delivered':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'sent':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function NotificationHistoryPage() {
  const { tenantId, isReady } = useTenantContext();
  const [selectedType, setSelectedType] = useState<string>('all');

  const { data: notifications, isLoading } = useQuery({
    queryKey: queryKeys.notifications.list(tenantId ?? '', { type: selectedType }),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.info('[NotificationHistory] Fetching notifications', { tenantId, selectedType });

      let query = supabase
        .from('notification_delivery_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedType !== 'all') {
        query = query.eq('notification_type', selectedType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[NotificationHistory] Failed to fetch notifications', { error });
        throw error;
      }

      logger.info('[NotificationHistory] Fetched notifications', { count: data.length });
      return data as NotificationDeliveryLog[];
    },
    enabled: isReady && !!tenantId,
  });

  if (!isReady) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-emerald-600" />
            <CardTitle>Notification History</CardTitle>
          </div>
          <CardDescription>View all notifications sent to your team and customers</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="order_status_change">Orders</TabsTrigger>
              <TabsTrigger value="delivery_alert">Deliveries</TabsTrigger>
              <TabsTrigger value="low_stock_alert">Stock</TabsTrigger>
              <TabsTrigger value="payment_received">Payments</TabsTrigger>
              <TabsTrigger value="invoice_overdue">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedType}>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : !notifications || notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No notifications found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="mt-1">{getStatusIcon(notification.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">
                                {NOTIFICATION_TYPE_LABELS[notification.notification_type as NotificationType] ??
                                  notification.notification_type}
                              </Badge>
                              <Badge variant={getStatusBadgeVariant(notification.status)}>
                                {notification.status}
                              </Badge>
                            </div>
                            {notification.subject && (
                              <p className="font-medium text-sm text-gray-900">{notification.subject}</p>
                            )}
                            {notification.message_preview && (
                              <p className="text-sm text-gray-600 line-clamp-2">{notification.message_preview}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>To: {notification.recipient}</span>
                          {notification.created_at && (
                            <span>
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                          )}
                          {notification.retry_count !== null && notification.retry_count > 0 && (
                            <span className="text-yellow-600">Retries: {notification.retry_count}</span>
                          )}
                        </div>
                        {notification.error_message && (
                          <p className="text-xs text-red-600 mt-1">Error: {notification.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
