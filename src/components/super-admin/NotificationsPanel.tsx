/**
 * Notifications Panel Component
 * Real-time notifications center with tabs
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'urgent' | 'info' | 'warning' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAction?: (notification: Notification) => void;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function NotificationsPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onAction,
  className,
  onClick,
}: NotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState('all');

  const allCount = notifications.length;
  const urgentCount = notifications.filter((n) => n.type === 'urgent').length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : activeTab === 'urgent'
        ? notifications.filter((n) => n.type === 'urgent')
        : notifications.filter((n) => n.type === 'info');

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'urgent':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'urgent':
        return 'border-destructive/20 bg-destructive/5';
      case 'warning':
        return 'border-warning/20 bg-warning/5';
      case 'success':
        return 'border-success/20 bg-success/5';
      default:
        return 'border-info/20 bg-info/5';
    }
  };

  return (
    <Card className={cn('w-full max-w-96 h-[80vh] flex flex-col', className)} onClick={onClick}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All
              {allCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {allCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="urgent">
              Urgent
              {urgentCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {urgentCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      getTypeColor(notification.type),
                      !notification.read && 'ring-2 ring-primary/20',
                      'hover:bg-accent'
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        onMarkRead(notification.id);
                      }
                      if (notification.action && onAction) {
                        onAction(notification);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getTypeIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                          {notification.action && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                notification.action?.onClick();
                              }}
                            >
                              {notification.action.label}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  No notifications
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {unreadCount > 0 && (
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full" onClick={onMarkAllRead}>
            Mark All as Read
          </Button>
        </div>
      )}
    </Card>
  );
}

