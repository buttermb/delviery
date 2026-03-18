/**
 * useLocationInventory Hook
 *
 * Provides inventory data filtered by location.
 * When no locationId is provided, fetches all inventory for the tenant.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface LocationInventoryItem {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  product?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    image_url?: string;
  };
  location?: {
    id: string;
    name: string;
  };
}

export function useLocationInventory(locationId?: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.locationInventory.byLocation(tenant?.id, locationId),
    queryFn: async (): Promise<LocationInventoryItem[]> => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('location_inventory')
        .select(`
          id,
          product_id,
          location_id,
          quantity,
          reserved_quantity,
          product:products(id, name, sku, category, image_url),
          location:locations(id, name)
        `)
        .eq('tenant_id', tenant.id);

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch location inventory', error, { component: 'useLocationInventory' });
        return [];
      }

      return (data ?? []) as LocationInventoryItem[];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
