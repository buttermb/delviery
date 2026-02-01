import { logger } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WholesaleDelivery {
  id: string;
  order_id: string;
  runner_id: string;
  status: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  scheduled_pickup_time: string | null;
  notes: string | null;
  current_location: any;
  created_at: string;
  client_id: string;
  total_value: number;
  collection_amount: number;
  total_weight: number;
  order: {
    id: string;
    order_number: string;
    client_id: string;
    total_amount: number;
    status: string;
    delivery_address: string;
    created_at: string;
  };
  client: {
    business_name: string;
    address: string;
    contact_name: string;
    phone: string;
  };
}

export function useWholesaleRunnerDeliveries(runnerId?: string) {
  return useQuery({
    queryKey: ['wholesale-runner-deliveries', runnerId],
    queryFn: async () => {
      if (!runnerId) return [];

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select(`
          *,
          order:wholesale_orders!inner(
            id,
            order_number,
            client_id,
            total_amount,
            status,
            delivery_address,
            created_at
          ),
          client:wholesale_clients!inner(
            business_name,
            address,
            contact_name,
            phone
          )
        `)
        .eq('runner_id', runnerId)
        .in('status', ['assigned', 'in_transit', 'picked_up'])
        .order('scheduled_pickup_time', { ascending: true, nullsFirst: false });

      if (error) {
        logger.error('Error fetching runner deliveries:', error);
        throw error;
      }

      return (data || []) as WholesaleDelivery[];
    },
    enabled: !!runnerId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useRunnerStats(runnerId?: string) {
  return useQuery({
    queryKey: ['runner-stats', runnerId],
    queryFn: async () => {
      if (!runnerId) return null;

      const today = new Date().toISOString().split('T')[0];

      // Get today's deliveries
      const { data: todayDeliveries, error: deliveriesError } = await supabase
        .from('wholesale_deliveries')
        .select('id, order:orders!inner(total_amount)')
        .eq('runner_id', runnerId)
        .eq('status', 'delivered')
        .gte('updated_at', today);

      if (deliveriesError) throw deliveriesError;

      // Get total deliveries
      const { count: totalDeliveries, error: countError } = await supabase
        .from('wholesale_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('runner_id', runnerId)
        .eq('status', 'delivered');

      if (countError) throw countError;

      // Calculate stats
      const todayCount = todayDeliveries?.length || 0;
      const todayEarnings = todayDeliveries?.reduce((sum, d: any) => {
        return sum + (d.order?.total_amount || 0) * 0.05; // 5% commission example
      }, 0) || 0;

      return {
        todayDeliveries: todayCount,
        todayEarnings,
        totalDeliveries: totalDeliveries || 0,
        completionRate: 100, // Can be calculated from delivery history
      };
    },
    enabled: !!runnerId,
  });
}
