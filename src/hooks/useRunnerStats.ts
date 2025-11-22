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

      // Calculate earnings (flat $5 per delivery)
      const todayEarnings = (todayDeliveries?.length || 0) * 5;
      const totalDeliveries = runner?.total_deliveries || 0;
      const completionRate = totalDeliveries > 0 ? 100 : 0;

      return {
        todayDeliveries: todayDeliveries?.length || 0,
        todayEarnings,
        totalDeliveries,
        completionRate,
        avgDeliveryTime: 45, // TODO: Calculate from location history
      };
    },
    enabled: !!runnerId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
