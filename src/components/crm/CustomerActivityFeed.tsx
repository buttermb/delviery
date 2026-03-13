import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, FileText, MessageSquare, UserCheck, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityEvent {
  id: string;
  type: 'order' | 'note' | 'status_change' | 'invoice' | 'tag_assigned' | 'communication';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface CustomerActivityFeedProps {
  customerId: string;
  limit?: number;
}

const ACTIVITY_ICONS = {
  order: ShoppingCart,
  note: MessageSquare,
  status_change: AlertCircle,
  invoice: FileText,
  tag_assigned: Tag,
  communication: MessageSquare,
};

const ACTIVITY_COLORS = {
  order: 'text-blue-600 bg-blue-500/10',
  note: 'text-purple-600 bg-purple-500/10',
  status_change: 'text-orange-600 bg-orange-500/10',
  invoice: 'text-emerald-600 bg-emerald-500/10',
  tag_assigned: 'text-pink-600 bg-pink-500/10',
  communication: 'text-indigo-600 bg-indigo-500/10',
};

/**
 * CustomerActivityFeed component
 *
 * Timeline on customer detail page showing: orders, notes, status changes,
 * communications. Most recent first.
 */
export function CustomerActivityFeed({ customerId, limit = 50 }: CustomerActivityFeedProps) {
  const { tenant } = useTenantAdminAuth();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: queryKeys.customers.detail(customerId, 'activity-feed'),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const events: ActivityEvent[] = [];

      // Fetch orders
      const { data: orders } = await supabase
        .from('unified_orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (orders) {
        orders.forEach((order) => {
          events.push({
            id: `order-${order.id}`,
            type: 'order',
            title: `Order #${order.order_number} placed`,
            description: `$${Number(order.total_amount || 0).toFixed(2)} - ${order.status}`,
            timestamp: order.created_at,
            metadata: { orderId: order.id, orderNumber: order.order_number },
          });
        });
      }

      // Fetch notes
      const { data: notes } = await (supabase as any)
        .from('customer_notes')
        .select(`
          id,
          content,
          created_at,
          profiles:created_by (full_name)
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notes) {
        notes.forEach((note: any) => {
          events.push({
            id: `note-${note.id}`,
            type: 'note',
            title: `Note added by ${note.profiles?.full_name || 'Unknown'}`,
            description: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
            timestamp: note.created_at,
          });
        });
      }

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, status, created_at')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (invoices) {
        invoices.forEach((invoice) => {
          events.push({
            id: `invoice-${invoice.id}`,
            type: 'invoice',
            title: `Invoice #${invoice.invoice_number} created`,
            description: `$${Number(invoice.total_amount || 0).toFixed(2)} - ${invoice.status}`,
            timestamp: invoice.created_at,
            metadata: { invoiceId: invoice.id },
          });
        });
      }

      // Fetch tag assignments
      const { data: tagAssignments } = await (supabase as any)
        .from('customer_tag_assignments')
        .select(`
          id,
          created_at,
          customer_tags:tag_id (name, color)
        `)
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tagAssignments) {
        tagAssignments.forEach((assignment: any) => {
          events.push({
            id: `tag-${assignment.id}`,
            type: 'tag_assigned',
            title: 'Tag assigned',
            description: assignment.customer_tags?.name || 'Unknown tag',
            timestamp: assignment.created_at,
          });
        });
      }

      // Sort all events by timestamp
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return events.slice(0, limit);
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>Recent customer activity and interactions</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No activity yet</div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            {activities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const colorClasses = ACTIVITY_COLORS[activity.type];

              return (
                <div key={activity.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background', colorClasses)}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold">{activity.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      </div>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </time>
                    </div>
                    <time className="text-xs text-muted-foreground block mt-1">
                      {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
