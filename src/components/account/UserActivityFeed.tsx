/**
 * User Activity Feed
 * Shows recent activity across the app
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, Package, Settings, TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ActivityItem {
  id: string;
  type: 'order' | 'update';
  title: string;
  description: string;
  timestamp: string;
  icon: any;
  color: string;
}

export default function UserActivityFeed({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [userId]);

  const fetchActivity = async () => {
    try {
      const [ordersResult, logsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, created_at, status, total_amount')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        
        supabase
          .from('account_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const combinedActivities: ActivityItem[] = [];

      // Add orders
      if (ordersResult.data) {
        ordersResult.data.forEach((order: any) => {
          combinedActivities.push({
            id: order.id,
            type: 'order',
            title: `Order ${order.status}`,
            description: `$${order.total_amount}`,
            timestamp: order.created_at,
            icon: ShoppingCart,
            color: 'text-blue-500'
          });
        });
      }

      // Add account logs
      if (logsResult.data) {
        logsResult.data.forEach((log: any) => {
          combinedActivities.push({
            id: log.id,
            type: 'update',
            title: log.action_type,
            description: log.description || '',
            timestamp: log.created_at,
            icon: Settings,
            color: 'text-gray-500'
          });
        });
      }

      // Sort by timestamp
      combinedActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(combinedActivities.slice(0, 15));
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (activity: ActivityItem) => {
    const Icon = activity.icon;
    return <Icon className={`h-5 w-5 ${activity.color}`} />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {getIcon(activity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <Badge variant="outline" className="text-xs">
                      {activity.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
