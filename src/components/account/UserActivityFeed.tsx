/**
 * User Activity Feed
 * Shows recent activity across the app
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, Package, Gift, Award, CreditCard, 
  Settings, User, Star, TrendingUp, Bell, Heart
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ActivityItem {
  id: string;
  type: 'order' | 'reward' | 'achievement' | 'update' | 'view' | 'favorite';
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
      const [ordersResult, rewardsResult, profileResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, created_at, status, total_amount')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('referral_rewards')
          .select('id, created_at, reward_type, reward_amount, status')
          .eq('referred_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3),
        
        supabase
          .from('profiles')
          .select('updated_at, referral_code')
          .eq('user_id', userId)
          .single()
      ]);

      const activityItems: ActivityItem[] = [];

      // Add order activities
      ordersResult.data?.forEach(order => {
        activityItems.push({
          id: order.id,
          type: 'order' as const,
          title: 'Order Placed',
          description: `Order #${order.id.slice(0, 8)} - $${order.total_amount}`,
          timestamp: order.created_at,
          icon: Package,
          color: order.status === 'delivered' ? 'text-green-600' : 'text-blue-600'
        });
      });

      // Add reward activities
      rewardsResult.data?.forEach(reward => {
        activityItems.push({
          id: reward.id,
          type: 'reward' as const,
          title: 'Reward Earned',
          description: `${reward.reward_type}: $${reward.reward_amount}`,
          timestamp: reward.created_at,
          icon: Gift,
          color: 'text-purple-600'
        });
      });

      // Sort by timestamp
      activityItems.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activityItems.slice(0, 10));
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`mt-0.5 ${activity.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {activity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

