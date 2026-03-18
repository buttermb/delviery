import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  Trash2,
  ExternalLink,
  Package,
  DollarSign,
  Truck,
  User,
  AlertTriangle,
  Calendar,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenantContext } from '@/hooks/useTenantContext';

import type { Notification } from './NotificationCenter';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  order_status: <Package className="h-4 w-4" />,
  payment: <DollarSign className="h-4 w-4" />,
  delivery: <Truck className="h-4 w-4" />,
  driver: <User className="h-4 w-4" />,
  stock: <AlertTriangle className="h-4 w-4" />,
  customer: <User className="h-4 w-4" />,
  invoice: <FileText className="h-4 w-4" />,
  menu: <Calendar className="h-4 w-4" />,
  system: <Info className="h-4 w-4" />,
  mention: <Bell className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertCircle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  order_status: 'text-blue-500',
  payment: 'text-green-500',
  delivery: 'text-purple-500',
  driver: 'text-orange-500',
  stock: 'text-red-500',
  customer: 'text-cyan-500',
  invoice: 'text-yellow-500',
  menu: 'text-pink-500',
  system: 'text-gray-500',
  mention: 'text-indigo-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

/** Resolve a relative admin path (e.g. "admin/orders/123") to an absolute
 *  path with the tenant slug prefix (e.g. "/acme/admin/orders/123").
 *  Already-absolute paths (starting with /) are returned as-is. */
function resolveActionUrl(actionUrl: string, tenantSlug: string | null): string {
  if (actionUrl.startsWith('/')) return actionUrl;
  return `/${tenantSlug}/${actionUrl}`;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useTenantContext();
  const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.info;
  const iconColor = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.info;

  const handleNavigate = (url: string) => {
    navigate(resolveActionUrl(url, tenantSlug));
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.action_url) {
      handleNavigate(notification.action_url);
      onClose();
    }
  };

  return (
    <div
      className={cn(
        'p-4 hover:bg-accent transition-colors cursor-pointer group',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', iconColor)}>{icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className={cn(
                'text-sm font-medium',
                !notification.read && 'font-semibold'
              )}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {notification.action_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate(notification.action_url!);
                    onClose();
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
