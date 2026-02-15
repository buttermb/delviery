/**
 * Order Tags Hook
 *
 * Provides tag management for order categorization including:
 * - Fetching tags for a specific order
 * - Assigning/removing tags from orders
 * - Batch operations for bulk order tagging
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Tag } from '@/hooks/useCustomerTags';

// Types
export interface OrderTag {
  id: string;
  tenant_id: string;
  order_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag;
}

/**
 * Hook to fetch tags for a specific order
 */
export function useOrderTags(orderId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.orderTags.byOrder(orderId || ''),
    queryFn: async () => {
      if (!tenant?.id || !orderId) throw new Error('No tenant or order');

      const { data, error } = await (supabase as any)
        .from('order_tags')
        .select('*, tag:tags(*)')
        .eq('tenant_id', tenant.id)
        .eq('order_id', orderId);

      if (error) {
        logger.error('Failed to fetch order tags', { error, orderId });
        throw error;
      }

      return data as OrderTag[];
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 30000,
  });
}

/**
 * Hook to assign a tag to an order
 */
export function useAssignOrderTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, tagId }: { orderId: string; tagId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('order_tags')
        .insert({
          tenant_id: tenant.id,
          order_id: orderId,
          tag_id: tagId,
        })
        .select('*, tag:tags(*)')
        .maybeSingle();

      if (error) {
        logger.error('Failed to assign order tag', { error, orderId, tagId });
        throw error;
      }

      return data as OrderTag;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.orderTags.byOrder(variables.orderId),
      });
    },
  });
}

/**
 * Hook to remove a tag from an order
 */
export function useRemoveOrderTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, tagId }: { orderId: string; tagId: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('order_tags')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('order_id', orderId)
        .eq('tag_id', tagId);

      if (error) {
        logger.error('Failed to remove order tag', { error, orderId, tagId });
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.orderTags.byOrder(variables.orderId),
      });
    },
  });
}

/**
 * Hook to batch assign tags to multiple orders
 */
export function useBatchAssignOrderTags() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderIds,
      tagIds,
    }: {
      orderIds: string[];
      tagIds: string[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const insertData = orderIds.flatMap((orderId) =>
        tagIds.map((tagId) => ({
          tenant_id: tenant.id!,
          order_id: orderId,
          tag_id: tagId,
        }))
      );

      const { error } = await (supabase as any)
        .from('order_tags')
        .upsert(insertData, { onConflict: 'order_id,tag_id', ignoreDuplicates: true });

      if (error) {
        logger.error('Failed to batch assign order tags', { error, orderIds, tagIds });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderTags.all });
      toast.success('Tags assigned successfully');
    },
  });
}

/**
 * Hook to batch remove tags from multiple orders
 */
export function useBatchRemoveOrderTags() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderIds,
      tagIds,
    }: {
      orderIds: string[];
      tagIds: string[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('order_tags')
        .delete()
        .eq('tenant_id', tenant.id)
        .in('order_id', orderIds)
        .in('tag_id', tagIds);

      if (error) {
        logger.error('Failed to batch remove order tags', { error, orderIds, tagIds });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orderTags.all });
      toast.success('Tags removed successfully');
    },
  });
}
