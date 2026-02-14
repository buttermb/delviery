import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay } from 'date-fns';

export function useRunnerStats(runnerId?: string) {
  return useQuery({
    queryKey: ['runner-stats', runnerId],
    queryFn: async () => {
      if (!runnerId) throw new Error('Runner ID required');

      const todayStart = startOfDay(new Date()).toISOString();

      // Get today's deliveries
      const { data: todayDeliveries, error: todayError } = await supabase
        .from('wholesale_deliveries')
        .select('id, order_id')
        .eq('runner_id', runnerId)
        .eq('status', 'delivered')
        .gte('delivered_at', todayStart);

      if (todayError) throw todayError;

      // Get total deliveries
      const { data: runner, error: runnerError } = await supabase
        .from('wholesale_runners')
        .select('total_deliveries')
        .eq('id', runnerId)
        .maybeSingle();

      if (runnerError) throw runnerError;

      // Get completed deliveries for stats
      const { data: completedDeliveries, error: statsError } = await supabase
        .from('wholesale_deliveries')
        .select('created_at, picked_up_at, delivered_at')
        .eq('runner_id', runnerId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to last 50 for recent average

      if (statsError) throw statsError;

      // Calculate earnings (flat $5 per delivery)
      const todayEarnings = (todayDeliveries?.length || 0) * 5;
      const totalDeliveries = runner?.total_deliveries || 0;
      const completionRate = totalDeliveries > 0 ? 100 : 0;

      // Calculate average delivery time
      let avgDeliveryTime = 0;
      if (completedDeliveries && completedDeliveries.length > 0) {
        const totalMinutes = completedDeliveries.reduce((acc, delivery) => {
          const start = delivery.picked_up_at ? new Date(delivery.picked_up_at) : new Date(delivery.created_at);
          const end = delivery.delivered_at ? new Date(delivery.delivered_at) : new Date();
          const diffMinutes = (end.getTime() - start.getTime()) / 60000;
          return acc + diffMinutes;
        }, 0);
        avgDeliveryTime = Math.round(totalMinutes / completedDeliveries.length);
      }

      return {
        todayDeliveries: todayDeliveries?.length || 0,
        todayEarnings,
        totalDeliveries,
        completionRate,
        avgDeliveryTime,
      };
    },
    enabled: !!runnerId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
