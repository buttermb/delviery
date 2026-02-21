/**
 * OrderHistoryDiff Component
 * Compares before/after states when an order is edited.
 * Highlights changed fields in the timeline, shows who made changes and when.
 * Diff includes quantity changes, status changes, price adjustments, customer changes.
 * Data pulled from order_audit_log metadata.
 */

import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import GitCompare from 'lucide-react/dist/esm/icons/git-compare';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Minus from 'lucide-react/dist/esm/icons/minus';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Clock from 'lucide-react/dist/esm/icons/clock';
import User from 'lucide-react/dist/esm/icons/user';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';

import {
  useOrderAuditLog,
  type OrderAuditLogEntry,
} from '@/hooks/useOrderAuditLog';
import { formatRelativeTime, formatSmartDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';

interface OrderHistoryDiffProps {
  orderId: string;
  maxHeight?: string;
  showHeader?: boolean;
  className?: string;
}

interface DiffField {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'changed';
}

interface ParsedDiff {
  entry: OrderAuditLogEntry;
  fields: DiffField[];
  hasChanges: boolean;
}

/**
 * Field labels for human-readable display
 */
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  payment_status: 'Payment Status',
  delivery_status: 'Delivery Status',
  total: 'Total',
  subtotal: 'Subtotal',
  tax: 'Tax',
  discount: 'Discount',
  shipping_fee: 'Shipping Fee',
  quantity: 'Quantity',
  customer_id: 'Customer',
  customer_name: 'Customer Name',
  customer_email: 'Customer Email',
  customer_phone: 'Customer Phone',
  delivery_address: 'Delivery Address',
  delivery_notes: 'Delivery Notes',
  runner_id: 'Runner',
  runner_name: 'Runner Name',
  items: 'Order Items',
  notes: 'Notes',
  priority: 'Priority',
  scheduled_date: 'Scheduled Date',
  scheduled_time: 'Scheduled Time',
  payment_method: 'Payment Method',
  coupon_code: 'Coupon Code',
  discount_amount: 'Discount Amount',
};

/**
 * Get a human-readable label for a field name
 */
function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    // Format as currency if it looks like a price
    if (Number.isFinite(value) && value >= 0 && value < 1000000) {
      return formatCurrency(value);
    }
    return value.toString();
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `${value.length} item${value.length !== 1 ? 's' : ''}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Parse an audit entry to extract diff fields
 */
function parseAuditEntry(entry: OrderAuditLogEntry): ParsedDiff {
  const fields: DiffField[] = [];

  // Handle direct field changes (old_value/new_value)
  if (entry.field_name && (entry.old_value !== null || entry.new_value !== null)) {
    const type: 'added' | 'removed' | 'changed' =
      entry.old_value === null ? 'added' : entry.new_value === null ? 'removed' : 'changed';

    fields.push({
      field: entry.field_name,
      label: getFieldLabel(entry.field_name),
      oldValue: entry.old_value,
      newValue: entry.new_value,
      type,
    });
  }

  // Handle complex changes from metadata
  if (entry.changes && typeof entry.changes === 'object') {
    const changes = entry.changes as Record<string, unknown>;

    // Check for before/after structure
    const before = changes.before as Record<string, unknown> | undefined;
    const after = changes.after as Record<string, unknown> | undefined;

    if (before && after) {
      // Compare before/after objects
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

      for (const key of allKeys) {
        const oldVal = before[key];
        const newVal = after[key];

        // Skip if values are the same
        if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

        // Skip if already added from field_name
        if (key === entry.field_name) continue;

        const type: 'added' | 'removed' | 'changed' =
          oldVal === undefined ? 'added' : newVal === undefined ? 'removed' : 'changed';

        fields.push({
          field: key,
          label: getFieldLabel(key),
          oldValue: oldVal,
          newValue: newVal,
          type,
        });
      }
    } else {
      // Handle flat changes object
      for (const [key, value] of Object.entries(changes)) {
        // Skip metadata fields
        if (['timestamp', 'source', 'user_id', 'before', 'after'].includes(key)) continue;

        // Check if it's a change object with old/new
        if (typeof value === 'object' && value !== null) {
          const changeObj = value as Record<string, unknown>;
          if ('old' in changeObj || 'new' in changeObj) {
            const type: 'added' | 'removed' | 'changed' =
              changeObj.old === undefined ? 'added' : changeObj.new === undefined ? 'removed' : 'changed';

            fields.push({
              field: key,
              label: getFieldLabel(key),
              oldValue: changeObj.old,
              newValue: changeObj.new,
              type,
            });
          }
        }
      }
    }
  }

  return {
    entry,
    fields,
    hasChanges: fields.length > 0,
  };
}

/**
 * Get color classes based on diff type
 */
function getDiffTypeColors(type: 'added' | 'removed' | 'changed'): {
  bg: string;
  text: string;
  border: string;
  icon: typeof Plus;
} {
  switch (type) {
    case 'added':
      return {
        bg: 'bg-green-50 dark:bg-green-950/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
        icon: Plus,
      };
    case 'removed':
      return {
        bg: 'bg-red-50 dark:bg-red-950/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        icon: Minus,
      };
    case 'changed':
    default:
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        icon: ArrowRight,
      };
  }
}

/**
 * Single diff field display
 */
function DiffFieldItem({ field }: { field: DiffField }) {
  const colors = getDiffTypeColors(field.type);
  const Icon = colors.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-md border',
        colors.bg,
        colors.border
      )}
    >
      <div className={cn('mt-0.5 flex-shrink-0', colors.text)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            {field.field}
          </Badge>
        </div>
        <div className="mt-1 text-sm">
          {field.type === 'added' && (
            <span className={colors.text}>
              Added: <span className="font-medium">{formatValue(field.newValue)}</span>
            </span>
          )}
          {field.type === 'removed' && (
            <span className={colors.text}>
              Removed: <span className="font-medium line-through">{formatValue(field.oldValue)}</span>
            </span>
          )}
          {field.type === 'changed' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground line-through">
                {formatValue(field.oldValue)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">
                {formatValue(field.newValue)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Single diff entry (grouped changes from one audit event)
 */
function DiffEntry({ parsed }: { parsed: ParsedDiff }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { entry, fields } = parsed;

  const actorName = entry.actor_name || entry.actor_email || 'System';
  const isSystem = entry.actor_type === 'system';

  // Determine summary of changes
  const changeSummary = useMemo(() => {
    const addedCount = fields.filter((f) => f.type === 'added').length;
    const removedCount = fields.filter((f) => f.type === 'removed').length;
    const changedCount = fields.filter((f) => f.type === 'changed').length;

    const parts: string[] = [];
    if (changedCount > 0) parts.push(`${changedCount} changed`);
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (removedCount > 0) parts.push(`${removedCount} removed`);

    return parts.join(', ') || 'No changes detected';
  }, [fields]);

  return (
    <div className="border rounded-lg bg-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
          >
            <div className="flex items-start gap-3 text-left">
              <div className="mt-0.5">
                <GitCompare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{changeSummary}</span>
                  <Badge variant="secondary" className="text-xs">
                    {fields.length} field{fields.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {isSystem ? 'System' : actorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatSmartDate(entry.created_at)}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-muted-foreground">
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
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {fields.map((field, idx) => (
              <DiffFieldItem key={`${field.field}-${idx}`} field={field} />
            ))}
            {entry.reason && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs">
                <strong>Reason:</strong> {entry.reason}
              </div>
            )}
            {entry.notes && (
              <div className="p-2 bg-muted/50 rounded-md text-xs">
                <strong>Notes:</strong> {entry.notes}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Main OrderHistoryDiff component
 */
export function OrderHistoryDiff({
  orderId,
  maxHeight = '500px',
  showHeader = true,
  className = '',
}: OrderHistoryDiffProps) {
  const { entries, isLoading, error } = useOrderAuditLog({
    orderId,
    enabled: !!orderId,
  });

  // Parse and filter entries that have actual changes
  const parsedDiffs = useMemo(() => {
    return entries
      .map(parseAuditEntry)
      .filter((parsed) => parsed.hasChanges);
  }, [entries]);

  // Group diffs by date
  const groupedDiffs = useMemo(() => {
    const groups: Record<string, ParsedDiff[]> = {};

    for (const parsed of parsedDiffs) {
      const dateKey = formatSmartDate(parsed.entry.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(parsed);
    }

    return groups;
  }, [parsedDiffs]);

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4" />
              Change History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
            <p className="text-sm">Failed to load change history</p>
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
              <GitCompare className="h-4 w-4" />
              Change History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (parsedDiffs.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4" />
              Change History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No changes recorded</p>
            <p className="text-xs mt-1">
              Edits to this order will appear here with before/after comparisons.
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
              <GitCompare className="h-4 w-4" />
              Change History
            </span>
            <Badge variant="secondary" className="text-xs">
              {parsedDiffs.length} change{parsedDiffs.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }}>
          <div className="p-4 space-y-6">
            {Object.entries(groupedDiffs).map(([dateKey, diffs]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                    {dateKey}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {diffs.map((parsed) => (
                    <DiffEntry key={parsed.entry.id} parsed={parsed} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export type { OrderHistoryDiffProps, DiffField, ParsedDiff };
