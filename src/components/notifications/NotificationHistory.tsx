import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Check, Trash2, Filter, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import { NotificationItem } from './NotificationItem';
import { useNotifications } from './useNotifications';

const NOTIFICATION_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'order_status', label: 'Order Status' },
  { value: 'payment', label: 'Payments' },
  { value: 'delivery', label: 'Deliveries' },
  { value: 'driver', label: 'Drivers' },
  { value: 'stock', label: 'Stock Alerts' },
  { value: 'customer', label: 'Customers' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'menu', label: 'Menus' },
  { value: 'system', label: 'System' },
  { value: 'mention', label: 'Mentions' },
];

export function NotificationHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Filter notifications
  const filteredNotifications = notifications.filter((notification) => {
    // Type filter
    if (typeFilter !== 'all' && notification.type !== typeFilter) {
      return false;
    }

    // Read filter
    if (readFilter === 'read' && !notification.read) {
      return false;
    }
    if (readFilter === 'unread' && notification.read) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            View and manage all your notifications
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllAsRead()}>
            <Check className="h-4 w-4 mr-2" />
            Mark all as read ({unreadCount})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {filteredNotifications.length} notification
              {filteredNotifications.length !== 1 ? 's' : ''}
            </CardTitle>
            {(searchQuery || typeFilter !== 'all' || readFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setReadFilter('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <p className="text-sm text-muted-foreground">
                {searchQuery || typeFilter !== 'all' || readFilter !== 'all'
                  ? 'No notifications match your filters'
                  : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onClose={() => {}}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
