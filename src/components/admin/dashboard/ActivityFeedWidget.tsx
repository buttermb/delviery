/**
 * Activity Feed Widget - Recent system activity
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle2, Package, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const mockActivities = [
  {
    id: '1',
    type: 'order',
    message: 'Order #ORD-1472 delivered',
    time: new Date(),
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  },
  {
    id: '2',
    type: 'menu',
    message: 'New menu created',
    time: new Date(Date.now() - 15 * 60 * 1000),
    icon: <Package className="h-4 w-4 text-blue-500" />,
  },
  {
    id: '3',
    type: 'payment',
    message: 'Payment received: $45,000',
    time: new Date(Date.now() - 60 * 60 * 1000),
    icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
  },
];

export function ActivityFeedWidget() {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity
        </h3>
        <Badge variant="outline">Live</Badge>
      </div>

      <div className="space-y-3">
        {mockActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5">{activity.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{activity.message}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatTime(activity.time)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
        View All Activity →
      </button>
    </Card>
  );
}

