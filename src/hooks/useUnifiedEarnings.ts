import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

type Timeframe = 'today' | 'week' | 'month';

interface EarningRecord {
  id: string;
  order_number: string;
  created_at: string;
  total_earned: number;
  type: 'courier' | 'runner';
  commission_amount?: number;
  tip_amount?: number;
  bonus_amount?: number;
  delivery_fee?: number;
  client_name?: string;
  customer_name?: string;
}

export function useUnifiedEarnings(
  role: 'courier' | 'runner',
  userId: string | undefined,
  timeframe: Timeframe
) {
  return useQuery({
    queryKey: queryKeys.unifiedEarnings.byUser(role, userId, timeframe),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      let startDate: Date;
      let endDate: Date = new Date();

      switch (timeframe) {
        case 'today':
          startDate = startOfDay(new Date());
          break;
        case 'week':
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
          endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
      }

      const earnings: EarningRecord[] = [];

      if (role === 'courier') {
        const { data: courierEarnings, error } = await supabase
          .from('courier_earnings')
          .select(`
            *,
            orders:order_id (order_number)
          `)
          .eq('courier_id', userId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        courierEarnings?.forEach((e) => {
          earnings.push({
            id: e.id,
            order_number: e.orders?.order_number || 'N/A',
            created_at: e.created_at,
            total_earned: e.total_earned,
            type: 'courier',
            commission_amount: e.commission_amount,
            tip_amount: e.tip_amount || 0,
            bonus_amount: e.bonus_amount || 0,
          });
        });
      } else {
        const { data: runnerDeliveries, error } = await supabase
          .from('wholesale_deliveries')
          .select(`
            id,
            delivered_at,
            order:order_id (
              order_number,
              client:client_id (business_name)
            )
          `)
          .eq('runner_id', userId)
          .eq('status', 'delivered')
          .gte('delivered_at', startDate.toISOString())
          .lte('delivered_at', endDate.toISOString())
          .order('delivered_at', { ascending: false });

        if (error) throw error;

        runnerDeliveries?.forEach((d) => {
          earnings.push({
            id: d.id,
            order_number: d.order?.order_number || 'N/A',
            created_at: d.delivered_at,
            total_earned: 5.00, // Flat fee per delivery
            type: 'runner',
            delivery_fee: 5.00,
            client_name: d.order?.client?.business_name,
          });
        });
      }

      const totals = earnings.reduce(
        (acc, e) => ({
          commission: acc.commission + (e.commission_amount || 0),
          tips: acc.tips + (e.tip_amount || 0),
          bonuses: acc.bonuses + (e.bonus_amount || 0),
          deliveryFees: acc.deliveryFees + (e.delivery_fee || 0),
          total: acc.total + e.total_earned,
        }),
        { commission: 0, tips: 0, bonuses: 0, deliveryFees: 0, total: 0 }
      );

      return { earnings, totals };
    },
    enabled: !!userId,
  });
}
