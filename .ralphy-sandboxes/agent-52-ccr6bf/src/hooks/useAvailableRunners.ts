import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export interface AvailableRunner {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  total_deliveries: number;
  rating: number;
}

interface UseAvailableRunnersOptions {
  enabled?: boolean;
  /** If true, only return runners with status 'available' */
  onlyAvailable?: boolean;
}

/**
 * Hook to fetch runners (fleet vehicles) that can be assigned to deliveries.
 * By default, returns only runners with 'available' status.
 */
export function useAvailableRunners(options: UseAvailableRunnersOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const { enabled = true, onlyAvailable = true } = options;

  return useQuery({
    queryKey: queryKeys.runners.available(),
    queryFn: async (): Promise<AvailableRunner[]> => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('wholesale_runners')
        .select(`
          id,
          full_name,
          phone,
          vehicle_type,
          vehicle_plate,
          status,
          current_lat,
          current_lng,
          total_deliveries,
          rating
        `)
        .eq('tenant_id', tenant.id)
        .order('rating', { ascending: false });

      if (onlyAvailable) {
        query = query.eq('status', 'available');
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as AvailableRunner[];
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 1000 * 30, // 30 seconds - runners status changes frequently
  });
}
