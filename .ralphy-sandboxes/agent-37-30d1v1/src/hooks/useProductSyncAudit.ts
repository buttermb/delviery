/**
 * useProductSyncAudit - Hook for viewing and managing product sync audit logs
 *
 * Provides access to the product_sync_audit table for:
 * - Viewing change history for a product
 * - Tracking sync status across storefronts
 * - Monitoring failed syncs and retry counts
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Product sync audit record from database
 */
export interface ProductSyncAuditRecord {
  id: string;
  tenant_id: string;
  product_id: string;
  field_changed: string;
  old_value: unknown;
  new_value: unknown;
  sync_source: 'admin_update' | 'realtime' | 'import' | 'api';
  sync_status: 'success' | 'pending' | 'failed';
  sync_started_at: string;
  sync_completed_at: string | null;
  changed_by: string | null;
  error_message: string | null;
  retry_count: number;
  affected_storefronts: string[];
  affected_menus: string[];
  created_at: string;
}

/**
 * Options for fetching product sync audit
 */
export interface UseProductSyncAuditOptions {
  /** Product ID to fetch audit for */
  productId?: string;
  /** Tenant ID for filtering */
  tenantId?: string;
  /** Limit number of records */
  limit?: number;
  /** Filter by sync status */
  status?: 'success' | 'pending' | 'failed';
  /** Filter by field changed */
  field?: string;
}

/**
 * Result from the hook
 */
export interface UseProductSyncAuditResult {
  /** Audit records */
  data: ProductSyncAuditRecord[];
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch the data */
  refetch: () => void;
  /** Get audit by field */
  getAuditByField: (field: string) => ProductSyncAuditRecord[];
  /** Get pending syncs count */
  pendingSyncsCount: number;
  /** Get failed syncs count */
  failedSyncsCount: number;
}

/**
 * Hook for fetching product sync audit records
 */
export function useProductSyncAudit(
  options: UseProductSyncAuditOptions = {}
): UseProductSyncAuditResult {
  const {
    productId,
    tenantId,
    limit = 50,
    status,
    field,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = ['product-sync-audit', productId, tenantId, status, field, limit];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ProductSyncAuditRecord[]> => {
      if (!tenantId) {
        logger.warn('[ProductSyncAudit] No tenantId provided');
        return [];
      }

      let query = supabase
        .from('product_sync_audit')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      if (status) {
        query = query.eq('sync_status', status);
      }

      if (field) {
        query = query.eq('field_changed', field);
      }

      const { data: records, error: queryError } = await query;

      if (queryError) {
        logger.error('[ProductSyncAudit] Failed to fetch audit records', queryError);
        throw queryError;
      }

      return (records || []) as ProductSyncAuditRecord[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const auditRecords = data || [];

  // Get audit records by field
  const getAuditByField = (fieldName: string): ProductSyncAuditRecord[] => {
    return auditRecords.filter((record) => record.field_changed === fieldName);
  };

  // Count pending syncs
  const pendingSyncsCount = auditRecords.filter(
    (record) => record.sync_status === 'pending'
  ).length;

  // Count failed syncs
  const failedSyncsCount = auditRecords.filter(
    (record) => record.sync_status === 'failed'
  ).length;

  return {
    data: auditRecords,
    isLoading,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
    getAuditByField,
    pendingSyncsCount,
    failedSyncsCount,
  };
}

/**
 * Hook for getting latest sync for each product
 */
export function useProductsLatestSync(tenantId: string | null) {
  return useQuery({
    queryKey: ['products-latest-sync', tenantId],
    queryFn: async (): Promise<Map<string, ProductSyncAuditRecord>> => {
      if (!tenantId) {
        return new Map();
      }

      // Get the latest sync record for each product
      const { data, error } = await supabase
        .from('product_sync_audit')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        logger.error('[ProductSyncAudit] Failed to fetch latest syncs', error);
        throw error;
      }

      // Group by product_id and take the first (most recent) for each
      const syncMap = new Map<string, ProductSyncAuditRecord>();

      for (const record of (data || []) as ProductSyncAuditRecord[]) {
        if (!syncMap.has(record.product_id)) {
          syncMap.set(record.product_id, record);
        }
      }

      return syncMap;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export default useProductSyncAudit;
