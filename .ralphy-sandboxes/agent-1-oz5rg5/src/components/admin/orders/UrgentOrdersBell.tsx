/**
 * Urgent Orders Bell Component
 *
 * Displays a notification bell with count of urgent orders
 * and a dropdown showing urgent order notifications.
 * Shows pulsing animation when there are unacknowledged urgent orders.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  usePriorityNotifications,
  useAcknowledgeNotification,
  useAcknowledgeAllNotifications,
  useUrgentNotificationCount,
  type PriorityNotification,
} from '@/hooks/useOrderPriority';
import { OrderPriorityFlag } from '@/components/admin/orders/OrderPriorityFlag';
import { formatDistanceToNow } from 'date-fns';
import Bell from 'lucide-react/dist/esm/icons/bell';
import BellRing from 'lucide-react/dist/esm/icons/bell-ring';
import Check from 'lucide-react/dist/esm/icons/check';
import CheckCheck from 'lucide-react/dist/esm/icons/check-check';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface UrgentOrdersBellProps {
  className?: string;
}

export function UrgentOrdersBell({ className }: UrgentOrdersBellProps) {
  const [open, setOpen] = useState(false);
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();

  const { data: notifications, isLoading } = usePriorityNotifications({ unacknowledgedOnly: true });
  const { data: urgentCount = 0 } = useUrgentNotificationCount();
  const acknowledgeMutation = useAcknowledgeNotification();
  const acknowledgeAllMutation = useAcknowledgeAllNotifications();

  const unacknowledgedCount = notifications?.length || 0;
  const hasUrgent = urgentCount > 0;

  const handleViewOrder = (notification: PriorityNotification) => {
    // Navigate to order detail
    if (tenant?.slug) {
      navigate(`/${tenant.slug}/admin/orders/${notification.order_id}`);
      setOpen(false);
    }
  };

  const handleAcknowledge = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    acknowledgeMutation.mutate(notificationId);
  };

  const handleAcknowledgeAll = () => {
    acknowledgeAllMutation.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label={`${unacknowledgedCount} priority notifications`}
        >
          {hasUrgent ? (
            <BellRing className="h-5 w-5 animate-pulse text-red-500" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unacknowledgedCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                'absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs',
                hasUrgent && 'animate-pulse'
              )}
            >
              {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-semibold">Priority Notifications</h4>
          {unacknowledgedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAcknowledgeAll}
              disabled={acknowledgeAllMutation.isPending}
              className="h-8 text-xs"
            >
              {acknowledgeAllMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-3 w-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No priority notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onView={handleViewOrder}
                  onAcknowledge={handleAcknowledge}
                  isAcknowledging={acknowledgeMutation.isPending}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications && notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                if (tenant?.slug) {
                  navigate(`/${tenant.slug}/admin/orders?priority=urgent,high`);
                  setOpen(false);
                }
              }}
            >
              View all priority orders
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: PriorityNotification;
  onView: (notification: PriorityNotification) => void;
  onAcknowledge: (notificationId: string, e: React.MouseEvent) => void;
  isAcknowledging: boolean;
}

function NotificationItem({
  notification,
  onView,
  onAcknowledge,
  isAcknowledging,
}: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        'flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/50',
        notification.priority === 'urgent' && 'bg-red-50/50 dark:bg-red-950/20'
      )}
      onClick={() => onView(notification)}
    >
      <div className="flex-shrink-0 pt-0.5">
        <OrderPriorityFlag
          priority={notification.priority as 'urgent' | 'high' | 'normal' | 'low'}
          showLabel={false}
          size="sm"
        />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium leading-tight">
          {notification.message || `Priority order notification`}
        </p>
        <p className="text-xs text-muted-foreground">
          {timeAgo}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 flex-shrink-0"
        onClick={(e) => onAcknowledge(notification.id, e)}
        disabled={isAcknowledging}
        title="Mark as read"
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default UrgentOrdersBell;
