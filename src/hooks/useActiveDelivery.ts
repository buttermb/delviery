import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCourier } from '@/contexts/CourierContext';

export function useActiveDelivery() {
  const { courier, role } = useCourier();

  return useQuery({
    queryKey: ['active-delivery', courier?.id, role],
    queryFn: async () => {
      if (!courier) return null;

      if (role === 'courier') {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('courier_id', courier.id)
          .in('status', ['accepted', 'picked_up', 'in_transit'])
          .order('accepted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data ? { ...data, type: 'courier' as const } : null;
      } else {
        const { data, error } = await supabase
          .from('wholesale_deliveries')
          .select(`
            *,
            order:order_id (
              order_number,
              total_amount,
              delivery_address,
              client:client_id (
                business_name,
                contact_name,
                phone
              )
            )
          `)
          .eq('runner_id', courier.id)
          .in('status', ['assigned', 'picked_up', 'in_transit'])
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data ? { ...data, type: 'runner' as const } : null;
      }
    },
    enabled: !!courier,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
