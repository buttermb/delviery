/**
 * Hook for managing menu product availability rules
 *
 * Provides CRUD operations for availability rules and
 * evaluation of product availability based on active rules.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// Types
export type AvailabilityRuleType = 'time_window' | 'day_of_week' | 'quantity_limit' | 'bundle_only';

export interface AvailabilityRule {
  id: string;
  menuId: string;
  productId: string;
  tenantId: string;
  ruleType: AvailabilityRuleType;
  isActive: boolean;

  // Time window
  startHour: number | null;
  endHour: number | null;

  // Day of week (0=Sunday, 6=Saturday)
  allowedDays: number[] | null;

  // Quantity limit
  maxQuantity: number | null;
  currentQuantityUsed: number;

  // Bundle-only
  bundleProductIds: string[] | null;

  // Display settings
  hideWhenUnavailable: boolean;
  unavailableMessage: string;

  createdAt: string;
  updatedAt: string;
}

export interface ProductAvailabilityStatus {
  productId: string;
  isAvailable: boolean;
  unavailableReason: string | null;
  hideProduct: boolean;
  activeRules: AvailabilityRule[];
}

export interface CreateRuleInput {
  menuId: string;
  productId: string;
  tenantId: string;
  ruleType: AvailabilityRuleType;
  isActive?: boolean;
  startHour?: number | null;
  endHour?: number | null;
  allowedDays?: number[] | null;
  maxQuantity?: number | null;
  bundleProductIds?: string[] | null;
  hideWhenUnavailable?: boolean;
  unavailableMessage?: string;
}

export interface UpdateRuleInput {
  id: string;
  tenantId: string;
  isActive?: boolean;
  startHour?: number | null;
  endHour?: number | null;
  allowedDays?: number[] | null;
  maxQuantity?: number | null;
  bundleProductIds?: string[] | null;
  hideWhenUnavailable?: boolean;
  unavailableMessage?: string;
}

// Helper to transform database row to AvailabilityRule
const transformRow = (row: Record<string, unknown>): AvailabilityRule => ({
  id: row.id as string,
  menuId: row.menu_id as string,
  productId: row.product_id as string,
  tenantId: row.tenant_id as string,
  ruleType: row.rule_type as AvailabilityRuleType,
  isActive: row.is_active as boolean,
  startHour: row.start_hour as number | null,
  endHour: row.end_hour as number | null,
  allowedDays: row.allowed_days as number[] | null,
  maxQuantity: row.max_quantity as number | null,
  currentQuantityUsed: (row.current_quantity_used as number) ?? 0,
  bundleProductIds: row.bundle_product_ids as string[] | null,
  hideWhenUnavailable: row.hide_when_unavailable as boolean,
  unavailableMessage: (row.unavailable_message as string) || 'Currently unavailable',
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

/**
 * Fetch all availability rules for a menu
 */
export const useMenuProductAvailabilityRules = (menuId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'availability-rules', menuId, tenantId],
    queryFn: async (): Promise<AvailabilityRule[]> => {
      if (!menuId || !tenantId) return [];

      const { data, error } = await supabase
        .from('menu_product_availability_rules')
        .select('id, menu_id, product_id, tenant_id, rule_type, is_active, start_hour, end_hour, allowed_days, max_quantity, current_quantity_used, bundle_product_ids, hide_when_unavailable, unavailable_message, created_at, updated_at')
        .eq('menu_id', menuId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch availability rules', { error, menuId, tenantId });
        return [];
      }

      return (data ?? []).map(transformRow);
    },
    enabled: !!menuId && !!tenantId,
    staleTime: 30 * 1000,
  });
};

/**
 * Fetch availability rules for a specific product on a menu
 */
export const useProductAvailabilityRules = (
  menuId?: string,
  productId?: string,
  tenantId?: string
) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'availability-rules', menuId, productId, tenantId],
    queryFn: async (): Promise<AvailabilityRule[]> => {
      if (!menuId || !productId || !tenantId) return [];

      const { data, error } = await supabase
        .from('menu_product_availability_rules')
        .select('id, menu_id, product_id, tenant_id, rule_type, is_active, start_hour, end_hour, allowed_days, max_quantity, current_quantity_used, bundle_product_ids, hide_when_unavailable, unavailable_message, created_at, updated_at')
        .eq('menu_id', menuId)
        .eq('product_id', productId)
        .eq('tenant_id', tenantId)
        .order('rule_type', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch product availability rules', {
          error,
          menuId,
          productId,
        });
        return [];
      }

      return (data ?? []).map(transformRow);
    },
    enabled: !!menuId && !!productId && !!tenantId,
    staleTime: 30 * 1000,
  });
};

/**
 * Create a new availability rule
 */
export const useCreateAvailabilityRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const insertData: Record<string, unknown> = {
        menu_id: input.menuId,
        product_id: input.productId,
        tenant_id: input.tenantId,
        rule_type: input.ruleType,
        is_active: input.isActive ?? true,
        hide_when_unavailable: input.hideWhenUnavailable ?? false,
        unavailable_message: input.unavailableMessage ?? 'Currently unavailable',
      };

      // Add type-specific fields
      if (input.ruleType === 'time_window') {
        insertData.start_hour = input.startHour;
        insertData.end_hour = input.endHour;
      } else if (input.ruleType === 'day_of_week') {
        insertData.allowed_days = input.allowedDays;
      } else if (input.ruleType === 'quantity_limit') {
        insertData.max_quantity = input.maxQuantity;
        insertData.current_quantity_used = 0;
      } else if (input.ruleType === 'bundle_only') {
        insertData.bundle_product_ids = input.bundleProductIds;
      }

      const { data, error } = await supabase
        .from('menu_product_availability_rules')
        .insert(insertData)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? transformRow(data) : null;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.menus.all, 'availability-rules', variables.menuId],
      });
      showSuccessToast('Rule Created', 'Availability rule has been added');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create availability rule', { error, message });
      showErrorToast('Failed to Create Rule', message);
    },
  });
};

/**
 * Update an existing availability rule
 */
export const useUpdateAvailabilityRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRuleInput) => {
      const updateData: Record<string, unknown> = {};

      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.startHour !== undefined) updateData.start_hour = input.startHour;
      if (input.endHour !== undefined) updateData.end_hour = input.endHour;
      if (input.allowedDays !== undefined) updateData.allowed_days = input.allowedDays;
      if (input.maxQuantity !== undefined) updateData.max_quantity = input.maxQuantity;
      if (input.bundleProductIds !== undefined) updateData.bundle_product_ids = input.bundleProductIds;
      if (input.hideWhenUnavailable !== undefined) updateData.hide_when_unavailable = input.hideWhenUnavailable;
      if (input.unavailableMessage !== undefined) updateData.unavailable_message = input.unavailableMessage;

      const { data, error } = await supabase
        .from('menu_product_availability_rules')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', input.tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? transformRow(data) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.menus.all, 'availability-rules'],
      });
      showSuccessToast('Rule Updated', 'Availability rule has been updated');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update availability rule', { error, message });
      showErrorToast('Failed to Update Rule', message);
    },
  });
};

/**
 * Delete an availability rule
 */
export const useDeleteAvailabilityRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase
        .from('menu_product_availability_rules')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.menus.all, 'availability-rules'],
      });
      showSuccessToast('Rule Deleted', 'Availability rule has been removed');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete availability rule', { error, message });
      showErrorToast('Failed to Delete Rule', message);
    },
  });
};

/**
 * Increment quantity used for a quantity-limited rule
 * Called when an order is placed
 */
export const useIncrementRuleQuantity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ruleId,
      tenantId,
      quantity = 1,
    }: {
      ruleId: string;
      tenantId: string;
      quantity?: number;
    }) => {
      // First get current quantity
      const { data: current, error: fetchError } = await supabase
        .from('menu_product_availability_rules')
        .select('current_quantity_used')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentUsed = (current?.current_quantity_used as number) ?? 0;

      // Update with incremented quantity
      const { data, error } = await supabase
        .from('menu_product_availability_rules')
        .update({ current_quantity_used: currentUsed + quantity })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? transformRow(data) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.menus.all, 'availability-rules'],
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to increment rule quantity', { error });
    },
  });
};

/**
 * Reset quantity used for quantity-limited rules (e.g., at start of new menu session)
 */
export const useResetRuleQuantities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, tenantId }: { menuId: string; tenantId: string }) => {
      const { error } = await supabase
        .from('menu_product_availability_rules')
        .update({ current_quantity_used: 0 })
        .eq('menu_id', menuId)
        .eq('tenant_id', tenantId)
        .eq('rule_type', 'quantity_limit');

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.menus.all, 'availability-rules', variables.menuId],
      });
      showSuccessToast('Quantities Reset', 'All quantity limits have been reset');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reset rule quantities', { error, message });
      showErrorToast('Failed to Reset Quantities', message);
    },
  });
};
