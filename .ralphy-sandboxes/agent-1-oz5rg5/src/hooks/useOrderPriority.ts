/**
 * Order Priority Hook
 *
 * Manages order priority with auto-priority rules,
 * tenant settings, and notification handling.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { unifiedOrdersKeys } from '@/hooks/useUnifiedOrders';
import type { OrderPriority } from '@/components/admin/orders/OrderPriorityFlag';

// Types
export interface TenantPrioritySettings {
  id: string;
  tenant_id: string;
  vip_customer_priority: 'normal' | 'high' | 'urgent';
  large_order_threshold: number;
  large_order_priority: 'normal' | 'high' | 'urgent';
  wholesale_default_priority: 'low' | 'normal' | 'high';
  urgent_delivery_hours: number;
  urgent_delivery_priority: 'high' | 'urgent';
  auto_priority_enabled: boolean;
  notify_on_urgent: boolean;
  notify_on_high: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriorityNotification {
  id: string;
  tenant_id: string;
  order_id: string;
  priority: OrderPriority;
  notification_type: 'new_urgent' | 'priority_changed' | 'delivery_approaching';
  message: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// Query key factory
export const priorityKeys = {
  all: ['order-priority'] as const,
  settings: (tenantId: string) => [...priorityKeys.all, 'settings', tenantId] as const,
  notifications: (tenantId: string) => [...priorityKeys.all, 'notifications', tenantId] as const,
  unacknowledged: (tenantId: string) => [...priorityKeys.all, 'unacknowledged', tenantId] as const,
};

/**
 * Hook to fetch tenant priority settings
 */
export function usePrioritySettings() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: priorityKeys.settings(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('tenant_priority_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch priority settings', { error });
        throw error;
      }

      // Return default settings if none exist
      if (!data) {
        return {
          id: '',
          tenant_id: tenant.id,
          vip_customer_priority: 'high' as const,
          large_order_threshold: 50000,
          large_order_priority: 'high' as const,
          wholesale_default_priority: 'normal' as const,
          urgent_delivery_hours: 2,
          urgent_delivery_priority: 'urgent' as const,
          auto_priority_enabled: true,
          notify_on_urgent: true,
          notify_on_high: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TenantPrioritySettings;
      }

      return data as TenantPrioritySettings;
    },
    enabled: !!tenant?.id,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Hook to update tenant priority settings
 */
export function useUpdatePrioritySettings() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<TenantPrioritySettings, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Upsert settings
      const { data, error } = await (supabase as any)
        .from('tenant_priority_settings')
        .upsert({
          tenant_id: tenant.id,
          ...settings,
        }, {
          onConflict: 'tenant_id',
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to update priority settings', { error });
        throw error;
      }

      return data as TenantPrioritySettings;
    },
    onSuccess: () => {
      toast.success('Priority settings updated');
      queryClient.invalidateQueries({ queryKey: priorityKeys.settings(tenant?.id || '') });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      logger.error('Failed to update priority settings', error, { component: 'useUpdatePrioritySettings' });
      toast.error('Failed to update priority settings', { description: message });
    },
  });
}

/**
 * Hook to update order priority
 */
export function useUpdateOrderPriority() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, priority }: { orderId: string; priority: OrderPriority }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Use the RPC function for proper tracking
      const { error } = await (supabase as any).rpc('update_order_priority', {
        p_order_id: orderId,
        p_priority: priority,
        p_user_id: admin?.id || null,
      });

      if (error) {
        logger.error('Failed to update order priority', { orderId, priority, error });
        throw error;
      }

      return { orderId, priority };
    },
    onMutate: async ({ orderId, priority }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });

      const previousOrders = queryClient.getQueriesData({ queryKey: unifiedOrdersKeys.lists() });

      // Update in cache - need to handle the structure properly
      queryClient.setQueriesData(
        { queryKey: unifiedOrdersKeys.lists() },
        (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((order: Record<string, unknown>) =>
            order.id === orderId ? { ...order, priority } : order
          );
        }
      );

      return { previousOrders };
    },
    onError: (error, _variables, context) => {
      // Rollback
      if (context?.previousOrders) {
        context.previousOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const message = error instanceof Error ? error.message : 'Failed to update priority';
      logger.error('Failed to update order priority', error, { component: 'useUpdateOrderPriority' });
      toast.error('Failed to update order priority', { description: message });
    },
    onSuccess: ({ priority }) => {
      toast.success(`Order priority updated to ${priority}`);
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: priorityKeys.notifications(tenant?.id || '') });
    },
  });
}

/**
 * Hook to fetch priority notifications
 */
export function usePriorityNotifications(options: { unacknowledgedOnly?: boolean } = {}) {
  const { tenant } = useTenantAdminAuth();
  const { unacknowledgedOnly = false } = options;

  return useQuery({
    queryKey: unacknowledgedOnly
      ? priorityKeys.unacknowledged(tenant?.id || '')
      : priorityKeys.notifications(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      let query = (supabase as any)
        .from('order_priority_notifications')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (unacknowledgedOnly) {
        query = query.eq('acknowledged', false);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch priority notifications', { error });
        throw error;
      }

      return data as PriorityNotification[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute for urgent notifications
  });
}

/**
 * Hook to acknowledge a priority notification
 */
export function useAcknowledgeNotification() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('order_priority_notifications')
        .update({
          acknowledged: true,
          acknowledged_by: admin?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to acknowledge notification', { notificationId, error });
        throw error;
      }

      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priorityKeys.notifications(tenant?.id || '') });
      queryClient.invalidateQueries({ queryKey: priorityKeys.unacknowledged(tenant?.id || '') });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to acknowledge';
      logger.error('Failed to acknowledge notification', error, { component: 'useAcknowledgeNotification' });
      toast.error('Failed to acknowledge notification', { description: message });
    },
  });
}

/**
 * Hook to acknowledge all notifications
 */
export function useAcknowledgeAllNotifications() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await (supabase as any)
        .from('order_priority_notifications')
        .update({
          acknowledged: true,
          acknowledged_by: admin?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant.id)
        .eq('acknowledged', false);

      if (error) {
        logger.error('Failed to acknowledge all notifications', { error });
        throw error;
      }

      return true;
    },
    onSuccess: () => {
      toast.success('All notifications acknowledged');
      queryClient.invalidateQueries({ queryKey: priorityKeys.notifications(tenant?.id || '') });
      queryClient.invalidateQueries({ queryKey: priorityKeys.unacknowledged(tenant?.id || '') });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to acknowledge';
      logger.error('Failed to acknowledge all notifications', error, { component: 'useAcknowledgeAllNotifications' });
      toast.error('Failed to acknowledge all notifications', { description: message });
    },
  });
}

/**
 * Hook to get count of unacknowledged urgent notifications
 */
export function useUrgentNotificationCount() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...priorityKeys.unacknowledged(tenant?.id || ''), 'count'],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { count, error } = await (supabase as any)
        .from('order_priority_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('acknowledged', false)
        .eq('priority', 'urgent');

      if (error) {
        logger.error('Failed to fetch urgent notification count', { error });
        throw error;
      }

      return count || 0;
    },
    enabled: !!tenant?.id,
    staleTime: 30000,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

/**
 * Calculate priority label based on numeric sort value
 */
export function getPrioritySortValue(priority: OrderPriority): number {
  switch (priority) {
    case 'urgent':
      return 1;
    case 'high':
      return 2;
    case 'normal':
      return 3;
    case 'low':
      return 4;
    default:
      return 3;
  }
}

/**
 * Sort orders by priority (urgent/high first)
 */
export function sortByPriority<T extends { priority?: OrderPriority; created_at?: string }>(
  orders: T[],
  ascending = false
): T[] {
  return [...orders].sort((a, b) => {
    const priorityA = getPrioritySortValue(a.priority || 'normal');
    const priorityB = getPrioritySortValue(b.priority || 'normal');

    if (priorityA !== priorityB) {
      return ascending ? priorityA - priorityB : priorityB - priorityA;
    }

    // Secondary sort by created_at
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ascending ? dateA - dateB : dateB - dateA;
  });
}
