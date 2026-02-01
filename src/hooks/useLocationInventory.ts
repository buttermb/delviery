/**
 * Hook for fetching inventory by location
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

interface LocationInventoryItem {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number | null;
  product?: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
  } | null;
}

interface InventorySummary {
  product_id: string;
  product_name: string;
  sku: string | null;
  location_count: number;
  total_quantity: number;
  total_reserved: number;
  available_quantity: number;
}

export function useLocationInventory(locationId?: string) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    data: inventory = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.inventory.byLocation(locationId || 'all'),
    queryFn: async (): Promise<LocationInventoryItem[]> => {
      if (!tenantId) return [];

      try {
        let query = (supabase as any)
          .from('location_inventory')
          .select(`
            id,
            location_id,
            product_id,
            quantity,
            reserved_quantity,
            product:products(id, name, sku),
            location:locations(id, name)
          `)
          .eq('tenant_id', tenantId);

        if (locationId) {
          query = query.eq('location_id', locationId);
        }

        const { data, error } = await query;

        // Table may not exist
        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;

        return (data || []) as LocationInventoryItem[];
      } catch (err) {
        // Return empty array if table doesn't exist
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Calculate summary across products (when viewing all locations)
  const summary: InventorySummary[] = !locationId
    ? Object.values(
        inventory.reduce(
          (acc, item) => {
            const key = item.product_id;
            if (!acc[key]) {
              acc[key] = {
                product_id: item.product_id,
                product_name: item.product?.name || 'Unknown',
                sku: item.product?.sku || null,
                location_count: 0,
                total_quantity: 0,
                total_reserved: 0,
                available_quantity: 0,
              };
            }
            acc[key].location_count += 1;
            acc[key].total_quantity += item.quantity;
            acc[key].total_reserved += item.reserved_quantity || 0;
            acc[key].available_quantity =
              acc[key].total_quantity - acc[key].total_reserved;
            return acc;
          },
          {} as Record<string, InventorySummary>
        )
      )
    : [];

  return {
    inventory,
    summary,
    isLoading,
    error,
    refetch,
  };
}
