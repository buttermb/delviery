/**
 * Courier Performance Tracker
 * Shows weekly/monthly performance metrics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, TrendingUp, Award, Flame } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

export default function CourierPerformanceTracker() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  const { data: performance, isLoading } = useQuery({
    queryKey: ['courier-performance', period],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'performance-stats', period }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to get performance stats';
        throw new Error(errorMessage);
      }

      return data;
    },
    refetchInterval: 60000, // Update every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 bg-neutral-800 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = performance || {
    deliveries: 0,
    target: 0,
    avgRating: 0,
    onTimeRate: 0,
    totalEarnings: 0,
    streak: 0,
  };

  const completionRate = stats.target > 0 ? (stats.deliveries / stats.target) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance Tracker
          </CardTitle>
          <Select value={period} onValueChange={(v: string) => setPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Completion Rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-400">Goal Progress</span>
            <Badge variant={completionRate >= 100 ? "default" : "secondary"}>
              {stats.deliveries} / {stats.target} deliveries
            </Badge>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-neutral-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-neutral-400">Avg Rating</span>
            </div>
            <div className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</div>
            <div className="text-xs text-neutral-500">stars</div>
          </div>

          <div className="p-4 bg-neutral-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-neutral-400">On-Time</span>
            </div>
            <div className="text-2xl font-bold">{stats.onTimeRate}%</div>
            <div className="text-xs text-neutral-500">delivery rate</div>
          </div>

          <div className="p-4 bg-neutral-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-neutral-400">Earnings</span>
            </div>
            <div className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</div>
            <div className="text-xs text-neutral-500">total</div>
          </div>

          <div className="p-4 bg-neutral-900 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-neutral-400">Streak</span>
            </div>
            <div className="text-2xl font-bold">{stats.streak}</div>
            <div className="text-xs text-neutral-500">days active</div>
          </div>
        </div>

        {/* Achievements */}
        {completionRate >= 100 && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Trophy className="w-4 h-4" />
              Goal Achieved! Keep it up! 🎉
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

