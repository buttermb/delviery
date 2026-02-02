/**
 * OrderTrackingTimeline
 * Displays a timeline of all status changes for an order with timestamps
 */

import { format } from 'date-fns';
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import User from "lucide-react/dist/esm/icons/user";
import Bot from "lucide-react/dist/esm/icons/bot";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import History from "lucide-react/dist/esm/icons/history";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderStatusHistory, type OrderStatusHistoryEntry } from '@/hooks/useOrderStatusHistory';
import { formatRelativeTime } from '@/lib/utils/formatDate';

interface OrderTrackingTimelineProps {
  orderId: string;
  className?: string;
  maxHeight?: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof Clock;
  colorClass: string;
  bgClass: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-100 border-yellow-200',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100 border-blue-200',
  },
  preparing: {
    label: 'Preparing',
    icon: Package,
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-100 border-orange-200',
  },
  processing: {
    label: 'Processing',
    icon: RefreshCw,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-100 border-indigo-200',
  },
  ready: {
    label: 'Ready',
    icon: Package,
    colorClass: 'text-cyan-600',
    bgClass: 'bg-cyan-100 border-cyan-200',
  },
  in_transit: {
    label: 'In Transit',
    icon: Truck,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100 border-blue-200',
  },
  delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-100 border-green-200',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-100 border-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100 border-red-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100 border-red-200',
  },
  refunded: {
    label: 'Refunded',
    icon: RefreshCw,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-100 border-purple-200',
  },
};

const ACTOR_CONFIG: Record<string, { label: string; icon: typeof User }> = {
  customer: { label: 'Customer', icon: User },
  courier: { label: 'Courier', icon: Truck },
  admin: { label: 'Admin', icon: User },
  merchant: { label: 'Merchant', icon: User },
  system: { label: 'System', icon: Bot },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || {
    label: status,
    icon: AlertTriangle,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100 border-gray-200',
  };
}

function getActorConfig(actor: string) {
  return ACTOR_CONFIG[actor] || { label: actor, icon: User };
}

function TimelineEntry({
  entry,
  isFirst,
  isLast
}: {
  entry: OrderStatusHistoryEntry;
  isFirst: boolean;
  isLast: boolean;
}) {
  const newStatusConfig = getStatusConfig(entry.new_status);
  const oldStatusConfig = entry.old_status ? getStatusConfig(entry.old_status) : null;
  const actorConfig = getActorConfig(entry.changed_by);
  const StatusIcon = newStatusConfig.icon;
  const ActorIcon = actorConfig.icon;

  return (
    <div className="flex gap-3 relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-muted" />
      )}

      {/* Status icon */}
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${newStatusConfig.bgClass}`}>
        <StatusIcon className={`h-4 w-4 ${newStatusConfig.colorClass}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex flex-col gap-1">
          {/* Status change */}
          <div className="flex items-center gap-2 flex-wrap">
            {oldStatusConfig ? (
              <>
                <Badge variant="outline" className="text-xs">
                  {oldStatusConfig.label}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Created as</span>
            )}
            <Badge
              variant="outline"
              className={`text-xs ${newStatusConfig.bgClass} ${newStatusConfig.colorClass} border`}
            >
              {newStatusConfig.label}
            </Badge>
          </div>

          {/* Timestamp and actor */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="font-medium">
              {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
            </span>
            <span className="text-muted-foreground/60">
              ({formatRelativeTime(entry.created_at)})
            </span>
          </div>

          {/* Changed by */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <ActorIcon className="h-3 w-3" />
            <span>by {actorConfig.label}</span>
          </div>

          {/* Notes */}
          {entry.notes && (
            <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
              {entry.notes}
            </p>
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
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderTrackingTimeline({
  orderId,
  className,
  maxHeight = '400px',
}: OrderTrackingTimelineProps) {
  const { data: history, isLoading, error } = useOrderStatusHistory({ orderId });

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive py-4">
            Failed to load order timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Order Timeline
          {history && history.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {history.length} update{history.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : !history || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No status changes recorded</p>
            <p className="text-xs mt-1">Status updates will appear here as the order progresses.</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <div className="space-y-0">
              {history.map((entry, index) => (
                <TimelineEntry
                  key={entry.id}
                  entry={entry}
                  isFirst={index === 0}
                  isLast={index === history.length - 1}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
