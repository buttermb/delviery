/**
 * OrderAuditLog Component
 * Displays a timeline of all changes made to an order with user attribution.
 * Shows who made changes, what changed, and when.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  History,
  Plus,
  RefreshCw,
  CreditCard,
  Truck,
  Package,
  FileText,
  UserCheck,
  XCircle,
  RotateCcw,
  CheckCircle,
  Edit,
  ArrowRight,
  User,
  Clock,
} from 'lucide-react';
import { formatRelativeTime, formatSmartDate } from '@/lib/utils/formatDate';
import {
  useOrderAuditLog,
  getAuditActionLabel,
  getAuditActionConfig,
  type OrderAuditLogEntry,
  type OrderAuditAction,
} from '@/hooks/useOrderAuditLog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface OrderAuditLogProps {
  orderId: string;
  maxHeight?: string;
  showHeader?: boolean;
  className?: string;
}

const ACTION_ICONS: Record<OrderAuditAction, typeof History> = {
  created: Plus,
  status_changed: RefreshCw,
  payment_updated: CreditCard,
  shipping_updated: Truck,
  items_modified: Package,
  notes_updated: FileText,
  assigned_courier: UserCheck,
  cancelled: XCircle,
  refunded: RotateCcw,
  delivered: CheckCircle,
  field_updated: Edit,
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'SY';
}

function formatChangeValue(value: string | null): string {
  if (!value) return 'None';
  if (value === 'null') return 'None';

  // Handle common status values
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    completed: 'Completed',
    refunded: 'Refunded',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partial: 'Partial',
  };

  return statusLabels[value] || value;
}

function AuditEntryItem({ entry }: { entry: OrderAuditLogEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getAuditActionConfig(entry.action);
  const Icon = ACTION_ICONS[entry.action] || Edit;
  const actorName = entry.actor_name || entry.actor_email || 'System';
  const isSystem = entry.actor_type === 'system';

  const hasDetails =
    entry.reason ||
    entry.notes ||
    (entry.changes && Object.keys(entry.changes).length > 0);

  return (
    <div className="ml-6 relative group">
      {/* Timeline dot with icon */}
      <div
        className={`absolute -left-[29px] mt-2 p-1.5 rounded-full border-2 ${config.bgColor} ${config.borderColor} group-hover:ring-2 ring-primary/20 transition-all`}
      >
        <Icon className={`h-3 w-3 ${config.color}`} />
      </div>

      {/* Entry content */}
      <div className="py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Action header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {getAuditActionLabel(entry.action)}
              </span>
              {entry.field_name && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">
                  {entry.field_name}
                </Badge>
              )}
            </div>

            {/* Change details */}
            {entry.old_value !== null || entry.new_value !== null ? (
              <div className="flex items-center gap-2 mt-1 text-sm">
                <span className="text-muted-foreground line-through">
                  {formatChangeValue(entry.old_value)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">
                  {formatChangeValue(entry.new_value)}
                </span>
              </div>
            ) : null}

            {/* Actor info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className={`text-[10px] ${isSystem ? 'bg-muted' : 'bg-primary/10'}`}>
                          {isSystem ? 'SY' : getInitials(entry.actor_name, entry.actor_email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={isSystem ? 'italic' : ''}>
                        {isSystem ? 'System' : actorName}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p><strong>User:</strong> {actorName}</p>
                      {entry.actor_email && <p><strong>Email:</strong> {entry.actor_email}</p>}
                      <p><strong>Source:</strong> {entry.source}</p>
                      <p><strong>Type:</strong> {entry.actor_type}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatSmartDate(entry.created_at)}
              </span>
            </div>

            {/* Expandable details */}
            {hasDetails && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 mt-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={`h-3 w-3 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-2 bg-muted/30 rounded-md text-xs space-y-1">
                    {entry.reason && (
                      <p>
                        <strong>Reason:</strong> {entry.reason}
                      </p>
                    )}
                    {entry.notes && (
                      <p>
                        <strong>Notes:</strong> {entry.notes}
                      </p>
                    )}
                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div>
                        <strong>Changes:</strong>
                        <pre className="mt-1 p-1 bg-muted rounded text-[10px] overflow-x-auto">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* Relative time */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(entry.created_at).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export function OrderAuditLog({
  orderId,
  maxHeight = '400px',
  showHeader = true,
  className = '',
}: OrderAuditLogProps) {
  const { entries, isLoading, error } = useOrderAuditLog({
    orderId,
    enabled: !!orderId,
  });

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, OrderAuditLogEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.created_at).toLocaleDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    }

    return groups;
  }, [entries]);

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Activity History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Failed to load activity history</p>
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
              <History className="h-4 w-4" />
              Activity History
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
              <History className="h-4 w-4" />
              Activity History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No activity recorded</p>
            <p className="text-xs mt-1">
              Changes to this order will appear here.
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
              <History className="h-4 w-4" />
              Activity History
            </span>
            <Badge variant="secondary" className="text-xs">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </Badge>
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
                  <AuditEntryItem key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { AuditEntryItem };
export type { OrderAuditLogProps };
