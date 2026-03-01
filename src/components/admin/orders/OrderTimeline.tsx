/**
 * OrderTimeline Component
 * Shows chronological timeline of all order events from activity_log.
 * Auto-updates via realtime subscription.
 */

import { useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ActivityLogEntry } from '@/lib/activityLog';
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
import Clock from 'lucide-react/dist/esm/icons/clock';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Package from 'lucide-react/dist/esm/icons/package';
import Truck from 'lucide-react/dist/esm/icons/truck';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Plus from 'lucide-react/dist/esm/icons/plus';
import History from 'lucide-react/dist/esm/icons/history';
import _User from 'lucide-react/dist/esm/icons/user';
import Bot from 'lucide-react/dist/esm/icons/bot';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealTimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatRelativeTime, formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { getInitials } from '@/lib/utils/getInitials';

interface OrderTimelineProps {
  orderId: string;
  className?: string;
  maxHeight?: string;
  showHeader?: boolean;
}

/**
 * Order event types with their display configuration
 */
const EVENT_CONFIG: Record<string, {
  label: string;
  icon: typeof Clock;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  created: {
    label: 'Order Created',
    icon: Plus,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-200',
  },
  confirmed: {
    label: 'Order Confirmed',
    icon: CheckCircle,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-200',
  },
  preparing: {
    label: 'Preparing Order',
    icon: Package,
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-200',
  },
  ready: {
    label: 'Order Ready',
    icon: CheckCircle,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-200',
  },
  payment_received: {
    label: 'Payment Received',
    icon: CreditCard,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-200',
  },
  items_picked: {
    label: 'Items Picked',
    icon: Package,
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-200',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: Truck,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-100',
    borderClass: 'border-indigo-200',
  },
  delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    colorClass: 'text-green-700',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-300',
  },
  completed: {
    label: 'Order Completed',
    icon: CheckCircle,
    colorClass: 'text-green-700',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-300',
  },
  cancelled: {
    label: 'Order Cancelled',
    icon: XCircle,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100',
    borderClass: 'border-red-200',
  },
  refunded: {
    label: 'Order Refunded',
    icon: RotateCcw,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-200',
  },
  updated: {
    label: 'Order Updated',
    icon: History,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-200',
  },
};

/**
 * Get event config with fallback for unknown events
 */
function getEventConfig(action: string) {
  return EVENT_CONFIG[action] || {
    label: action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: History,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-200',
  };
}

/**
 * Get initials from order event user info (metadata or userId)
 */
function getEventInitials(userId: string | null, metadata: Record<string, unknown> | null): string {
  if (metadata && typeof metadata === 'object') {
    const name = metadata.user_name as string | undefined;
    const email = metadata.user_email as string | undefined;
    return getInitials(name, email, userId ? userId.slice(0, 2).toUpperCase() : 'SY');
  }
  if (userId) {
    return userId.slice(0, 2).toUpperCase();
  }
  return 'SY';
}

/**
 * Get display name for the user
 */
function getUserDisplayName(userId: string | null, metadata: Record<string, unknown> | null): string {
  if (metadata && typeof metadata === 'object') {
    const name = metadata.user_name as string | undefined;
    const email = metadata.user_email as string | undefined;
    if (name) return name;
    if (email) return email;
  }
  return userId ? 'User' : 'System';
}

/**
 * Check if the action was performed by system
 */
function isSystemAction(userId: string | null, metadata: Record<string, unknown> | null): boolean {
  if (!userId) return true;
  if (metadata && metadata.actor_type === 'system') return true;
  return false;
}

interface TimelineEventProps {
  event: ActivityLogEntry;
  isLast: boolean;
}

function TimelineEvent({ event, isLast }: TimelineEventProps) {
  const config = getEventConfig(event.action);
  const Icon = config.icon;
  const isSystem = isSystemAction(event.user_id, event.metadata);
  const displayName = getUserDisplayName(event.user_id, event.metadata);
  const initials = getEventInitials(event.user_id, event.metadata);
  const notes = event.metadata?.notes as string | undefined;

  return (
    <div className="flex gap-3 relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-muted" />
      )}

      {/* Event icon */}
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${config.bgClass} ${config.borderClass}`}
      >
        <Icon className={`h-4 w-4 ${config.colorClass}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-col gap-1">
          {/* Event label */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{config.label}</span>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium cursor-default">
                    {formatSmartDate(event.created_at, { includeTime: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatSmartDate(event.created_at, { includeTime: true })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground/60">
              ({formatRelativeTime(event.created_at)})
            </span>
          </div>

          {/* User info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Avatar className="h-5 w-5">
              <AvatarFallback className={`text-[10px] ${isSystem ? 'bg-muted' : 'bg-primary/10'}`}>
                {isSystem ? <Bot className="h-3 w-3" /> : initials}
              </AvatarFallback>
            </Avatar>
            <span className={isSystem ? 'italic' : ''}>
              by {isSystem ? 'System' : displayName}
            </span>
          </div>

          {/* Notes */}
          {notes && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Fetch order activity events from activity_log
 */
async function fetchOrderTimeline(
  tenantId: string,
  orderId: string
): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[OrderTimeline] Failed to fetch order timeline', error, {
      tenantId,
      orderId,
    });
    throw error;
  }

  return (data ?? []) as ActivityLogEntry[];
}

export function OrderTimeline({
  orderId,
  className,
  maxHeight = '400px',
  showHeader = true,
}: OrderTimelineProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id ?? null;
  const queryClient = useQueryClient();

  // Query for fetching order timeline events
  const {
    data: events,
    isLoading,
    error,
  } = useQuery({
    queryKey: [...queryKeys.activity.byEntity(tenantId ?? '', 'order', orderId)],
    queryFn: () => {
      if (!tenantId) {
        return Promise.resolve([]);
      }
      return fetchOrderTimeline(tenantId, orderId);
    },
    enabled: !!tenantId && !!orderId,
    staleTime: 30000, // 30 seconds
  });

  // Realtime subscription for live updates
  useRealTimeSubscription({
    table: 'activity_log',
    tenantId,
    event: 'INSERT',
    enabled: !!tenantId && !!orderId,
    callback: (payload) => {
      // Only refresh if the insert is for this order
      const newRecord = payload.new as Record<string, unknown> | null;
      if (
        newRecord &&
        newRecord.entity_type === 'order' &&
        newRecord.entity_id === orderId
      ) {
        logger.debug('[OrderTimeline] New activity received, refreshing', {
          orderId,
          action: newRecord.action,
        });
        // Invalidate query to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.activity.byEntity(tenantId ?? '', 'order', orderId),
        });
      }
    },
  });

  // Memoize sorted events (newest first is already from query)
  const sortedEvents = useMemo(() => events ?? [], [events]);

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              Order Timeline
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-destructive">Failed to load order timeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Order Timeline
            {sortedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No events recorded</p>
            <p className="text-xs mt-1">Order activity will appear here as events occur.</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <div className="space-y-0">
              {sortedEvents.map((event, index) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  isLast={index === sortedEvents.length - 1}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export type { OrderTimelineProps };
