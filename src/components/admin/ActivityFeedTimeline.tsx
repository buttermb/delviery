/**
 * ActivityFeedTimeline
 * A filterable timeline component for the unified activity feed.
 * Displays activity entries in a chronological timeline with category/severity filtering.
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import User from "lucide-react/dist/esm/icons/user";
import Settings from "lucide-react/dist/esm/icons/settings";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Truck from "lucide-react/dist/esm/icons/truck";
import Activity from "lucide-react/dist/esm/icons/activity";
import Users from "lucide-react/dist/esm/icons/users";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Info from "lucide-react/dist/esm/icons/info";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { formatRelativeTime } from '@/lib/utils/formatDate';
import type { ActivityLogEntry, ActivityCategory, ActivitySeverity } from '@/hooks/useActivityFeed';

interface ActivityFeedTimelineProps {
  entries: ActivityLogEntry[];
  isLoading?: boolean;
  maxHeight?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  order: { icon: ShoppingCart, label: 'Order', color: 'text-blue-500' },
  inventory: { icon: Package, label: 'Inventory', color: 'text-amber-500' },
  user: { icon: User, label: 'User', color: 'text-violet-500' },
  system: { icon: Activity, label: 'System', color: 'text-gray-500' },
  payment: { icon: CreditCard, label: 'Payment', color: 'text-emerald-500' },
  settings: { icon: Settings, label: 'Settings', color: 'text-slate-500' },
  crm: { icon: Users, label: 'CRM', color: 'text-indigo-500' },
  delivery: { icon: Truck, label: 'Delivery', color: 'text-orange-500' },
};

const SEVERITY_CONFIG: Record<string, { icon: typeof Info; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  info: { icon: Info, label: 'Info', variant: 'secondary' },
  success: { icon: CheckCircle, label: 'Success', variant: 'default' },
  warning: { icon: AlertTriangle, label: 'Warning', variant: 'outline' },
  error: { icon: AlertCircle, label: 'Error', variant: 'destructive' },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.system;
}

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
}

export function ActivityFeedTimeline({ entries, isLoading, maxHeight = '600px' }: ActivityFeedTimelineProps) {
  // Group entries by date for visual separation
  const groupedEntries = useMemo(() => {
    const groups: Record<string, ActivityLogEntry[]> = {};

    for (const entry of entries) {
      const dateKey = new Date(entry.created_at).toLocaleDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    }

    return groups;
  }, [entries]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4">
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

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm font-medium">No activity found</p>
        <p className="text-xs mt-1">Activity will appear here as actions are performed.</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="relative border-l-2 border-muted ml-4 space-y-1 pb-4">
        {Object.entries(groupedEntries).map(([dateKey, dateEntries]) => (
          <div key={dateKey}>
            <div className="ml-6 pt-4 pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {dateKey}
              </span>
            </div>
            {dateEntries.map((entry) => {
              const categoryConfig = getCategoryConfig(entry.category);
              const severityConfig = getSeverityConfig(entry.severity);
              const CategoryIcon = categoryConfig.icon;

              return (
                <div key={entry.id} className="ml-6 relative group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[29px] mt-2 bg-background p-1 rounded-full border-2 border-muted group-hover:border-primary transition-colors`}>
                    <CategoryIcon className={`h-3 w-3 ${categoryConfig.color}`} />
                  </div>

                  {/* Entry content */}
                  <div className="py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{entry.action}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {categoryConfig.label}
                          </Badge>
                          {entry.severity !== 'info' && (
                            <Badge variant={severityConfig.variant} className="text-xs px-1.5 py-0">
                              {severityConfig.label}
                            </Badge>
                          )}
                        </div>
                        {entry.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {entry.user_email && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.user_email}
                            </span>
                          )}
                          {entry.resource && (
                            <span className="text-muted-foreground/70">
                              {entry.resource}
                              {entry.resource_id ? ` #${entry.resource_id.slice(0, 8)}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export { CATEGORY_CONFIG, SEVERITY_CONFIG };
export type { ActivityFeedTimelineProps };
