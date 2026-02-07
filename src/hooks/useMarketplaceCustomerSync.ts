/**
 * Hook for syncing marketplace (storefront) customers to the admin customer hub
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface SyncResult {
  synced_count: number;
  skipped_count: number;
  error_count: number;
}

interface UseMarketplaceCustomerSyncOptions {
  onSuccess?: (result: SyncResult) => void;
  onError?: (error: Error) => void;
}

export function useMarketplaceCustomerSync(options?: UseMarketplaceCustomerSyncOptions) {
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async (storeId?: string) => {
      const { data, error } = await (supabase as any)
        .rpc('sync_all_marketplace_customers_to_hub', {
          p_store_id: storeId ?? null,
        });

      if (error) {
        logger.error('Failed to sync marketplace customers', error, {
          component: 'useMarketplaceCustomerSync',
        });
        throw error;
      }

      // The RPC returns an array with a single row
      const result = Array.isArray(data) ? data[0] : data;
      return result as unknown as SyncResult;
    },
    onSuccess: (result) => {
      // Invalidate both marketplace customers and customers queries
      queryClient.invalidateQueries({ queryKey: queryKeys.storefront.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });

      if (result.synced_count > 0) {
        toast.success(`Synced ${result.synced_count} customer(s) to hub`, {
          description: result.skipped_count > 0
            ? `${result.skipped_count} skipped, ${result.error_count} errors`
            : undefined,
        });
      } else if (result.skipped_count > 0) {
        toast.info('No new customers to sync', {
          description: `${result.skipped_count} customers were skipped`,
        });
      } else {
        toast.info('No marketplace customers found to sync');
      }

      options?.onSuccess?.(result);
    },
    onError: (error: Error) => {
      toast.error('Failed to sync customers', {
        description: error.message,
      });
      options?.onError?.(error);
    },
  });

  return {
    sync: syncMutation.mutate,
    syncAsync: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
  };
}
