/**
 * Activity Feed Component
 * Timeline of recent activities
 */

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  type: 'tenant_created' | 'tenant_updated' | 'subscription_changed' | 'payment_received' | 'system_event';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

const activityIcons: Record<ActivityItem['type'], string> = {
  tenant_created: '🏢',
  tenant_updated: '✏️',
  subscription_changed: '💳',
  payment_received: '💰',
  system_event: '⚙️',
};

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  return (
    <ScrollArea className={cn('h-[300px]', className)}>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 pb-4 border-b last:border-0"
          >
            <div className="text-2xl">{activityIcons[item.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(item.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No recent activity
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

