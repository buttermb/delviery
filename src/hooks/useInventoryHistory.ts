import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface InventoryHistoryEntry {
  id: string;
  tenant_id: string;
  product_id: string;
  change_type: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment' | 'sale' | 'return' | 'receiving' | 'disposal';
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string | null;
  };
}

export interface InventoryHistoryFilters {
  productId?: string;
  changeType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useInventoryHistory(filters: InventoryHistoryFilters = {}) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.inventory.history({
      tenantId: tenant?.id,
      ...filters,
    }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = (supabase as any)
        .from('inventory_history')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (filters.productId) {
        query = query.eq('product_id', filters.productId);
      }

      if (filters.changeType) {
        query = query.eq('change_type', filters.changeType);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch inventory history', { error, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as InventoryHistoryEntry[];
    },
    enabled: !!tenant?.id,
  });
}
