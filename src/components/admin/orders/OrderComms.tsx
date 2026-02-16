/**
 * OrderComms Component
 * Shows all communications related to an order including SMS, emails,
 * internal notes, and notification history.
 * Aggregated from notifications_log and courier_messages tables.
 */

import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Phone from 'lucide-react/dist/esm/icons/phone';
import Bell from 'lucide-react/dist/esm/icons/bell';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Send from 'lucide-react/dist/esm/icons/send';
import User from 'lucide-react/dist/esm/icons/user';
import Bot from 'lucide-react/dist/esm/icons/bot';
import Truck from 'lucide-react/dist/esm/icons/truck';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatRelativeTime, formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

export interface OrderCommsProps {
  orderId: string;
  className?: string;
  maxHeight?: string;
  showHeader?: boolean;
}

type CommType = 'sms' | 'email' | 'notification' | 'internal' | 'courier';

interface CommunicationEntry {
  id: string;
  type: CommType;
  content: string;
  recipient?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  senderType: 'system' | 'admin' | 'courier' | 'customer';
  status: 'sent' | 'delivered' | 'failed' | 'pending' | 'read';
  createdAt: string;
  deliveredAt?: string;
  errorMessage?: string;
}

const COMM_TYPE_CONFIG: Record<CommType, {
  label: string;
  icon: typeof MessageSquare;
  colorClass: string;
  bgClass: string;
}> = {
  sms: {
    label: 'SMS',
    icon: Phone,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100',
  },
  email: {
    label: 'Email',
    icon: Mail,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-100',
  },
  notification: {
    label: 'Notification',
    icon: Bell,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-100',
  },
  internal: {
    label: 'Internal Note',
    icon: MessageSquare,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
  },
  courier: {
    label: 'Courier Message',
    icon: Truck,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-100',
  },
};

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle;
  colorClass: string;
}> = {
  delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    colorClass: 'text-green-600',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    colorClass: 'text-blue-600',
  },
  read: {
    label: 'Read',
    icon: CheckCircle,
    colorClass: 'text-green-700',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    colorClass: 'text-amber-600',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    colorClass: 'text-red-600',
  },
};

function getSenderIcon(senderType: string) {
  switch (senderType) {
    case 'system':
      return Bot;
    case 'courier':
      return Truck;
    default:
      return User;
  }
}

function getSenderLabel(senderType: string): string {
  const labels: Record<string, string> = {
    system: 'System',
    admin: 'Admin',
    courier: 'Courier',
    customer: 'Customer',
  };
  return labels[senderType] || 'Unknown';
}

function CommEntryItem({ entry }: { entry: CommunicationEntry }) {
  const typeConfig = COMM_TYPE_CONFIG[entry.type];
  const statusConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
  const Icon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;
  const SenderIcon = getSenderIcon(entry.senderType);

  return (
    <div className="ml-6 relative group">
      {/* Timeline dot with icon */}
      <div
        className={cn(
          'absolute -left-[29px] mt-2 p-1.5 rounded-full border-2 border-background',
          typeConfig.bgClass,
          'group-hover:ring-2 ring-primary/20 transition-all'
        )}
      >
        <Icon className={cn('h-3 w-3', typeConfig.colorClass)} />
      </div>

      {/* Entry content */}
      <div className="py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Type and status header */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {typeConfig.label}
              </Badge>
              <span className={cn('flex items-center gap-1 text-xs', statusConfig.colorClass)}>
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
              {entry.deliveredAt && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-muted-foreground">
                        Delivered {formatRelativeTime(entry.deliveredAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {new Date(entry.deliveredAt).toLocaleString()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Recipient info */}
            {(entry.recipientPhone || entry.recipientEmail) && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>To:</span>
                {entry.recipientPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {entry.recipientPhone}
                  </span>
                )}
                {entry.recipientEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {entry.recipientEmail}
                  </span>
                )}
              </div>
            )}

            {/* Message content */}
            <div className="mt-2 p-2 bg-muted/30 rounded-md">
              <p className="text-sm whitespace-pre-wrap break-words line-clamp-4">
                {entry.content}
              </p>
            </div>

            {/* Error message if failed */}
            {entry.status === 'failed' && entry.errorMessage && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600">
                  <span className="font-medium">Error:</span> {entry.errorMessage}
                </p>
              </div>
            )}

            {/* Sender and time info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-muted">
                    <SenderIcon className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <span>{getSenderLabel(entry.senderType)}</span>
              </div>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatSmartDate(entry.createdAt)}
              </span>
            </div>
          </div>

          {/* Relative time */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(entry.createdAt).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

async function fetchOrderCommunications(orderId: string): Promise<CommunicationEntry[]> {
  const entries: CommunicationEntry[] = [];

  // Fetch from notifications_log
  try {
    const { data: notifications, error: notifError } = await supabase
      .from('notifications_log')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (notifError) {
      // Table might not exist - handle gracefully
      if (notifError.code !== '42P01') {
        logger.warn('Failed to fetch notifications_log', { error: notifError });
      }
    } else if (notifications) {
      for (const notif of notifications) {
        const type: CommType = notif.notification_type === 'sms'
          ? 'sms'
          : notif.notification_type === 'email'
            ? 'email'
            : 'notification';

        entries.push({
          id: notif.id,
          type,
          content: notif.message_content || '',
          recipientPhone: notif.recipient_phone || undefined,
          recipientEmail: notif.recipient_email || undefined,
          senderType: 'system',
          status: notif.status === 'delivered'
            ? 'delivered'
            : notif.status === 'sent'
              ? 'sent'
              : notif.status === 'failed'
                ? 'failed'
                : 'pending',
          createdAt: notif.created_at || new Date().toISOString(),
          deliveredAt: notif.delivered_at || undefined,
          errorMessage: notif.error_message || undefined,
        });
      }
    }
  } catch (err) {
    logger.warn('Error fetching notifications_log', { error: err });
  }

  // Fetch from courier_messages
  try {
    const { data: courierMessages, error: courierError } = await supabase
      .from('courier_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (courierError) {
      if (courierError.code !== '42P01') {
        logger.warn('Failed to fetch courier_messages', { error: courierError });
      }
    } else if (courierMessages) {
      for (const msg of courierMessages) {
        entries.push({
          id: msg.id,
          type: 'courier',
          content: msg.message || '',
          senderType: msg.sender_type === 'admin' ? 'admin' : 'courier',
          status: msg.read ? 'read' : 'sent',
          createdAt: msg.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    logger.warn('Error fetching courier_messages', { error: err });
  }

  // Sort all entries by created_at descending
  entries.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return entries;
}

export function OrderComms({
  orderId,
  className = '',
  maxHeight = '400px',
  showHeader = true,
}: OrderCommsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: queryKeys.orderComms.byOrder(orderId),
    queryFn: () => fetchOrderCommunications(orderId),
    enabled: !!orderId && !!tenantId,
    staleTime: 30000, // 30 seconds
  });

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, CommunicationEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.createdAt).toLocaleDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    }

    return groups;
  }, [entries]);

  // Calculate stats
  const stats = useMemo(() => {
    const smsSent = entries.filter(e => e.type === 'sms').length;
    const emailsSent = entries.filter(e => e.type === 'email').length;
    const delivered = entries.filter(e => e.status === 'delivered' || e.status === 'read').length;
    const failed = entries.filter(e => e.status === 'failed').length;

    return { smsSent, emailsSent, delivered, failed };
  }, [entries]);

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Communications
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Failed to load communications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Communications
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Communications
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No communications yet</p>
            <p className="text-xs mt-1">
              SMS, emails, and notifications for this order will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Communications
            </span>
            <div className="flex items-center gap-2">
              {stats.smsSent > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Phone className="h-3 w-3 mr-1" />
                  {stats.smsSent} SMS
                </Badge>
              )}
              {stats.emailsSent > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Mail className="h-3 w-3 mr-1" />
                  {stats.emailsSent}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {entries.length} total
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="relative border-l-2 border-muted ml-4 space-y-1 pb-4 px-4">
            {Object.entries(groupedEntries).map(([dateKey, dateEntries]) => (
              <div key={dateKey}>
                <div className="ml-6 pt-4 pb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {dateKey === new Date().toLocaleDateString() ? 'Today' : dateKey}
                  </span>
                </div>
                {dateEntries.map((entry) => (
                  <CommEntryItem key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { CommEntryItem };
