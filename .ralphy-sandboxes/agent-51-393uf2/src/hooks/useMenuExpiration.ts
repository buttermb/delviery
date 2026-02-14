import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { publish } from '@/lib/eventBus';

export interface ExpiringMenu {
  id: string;
  name: string;
  tenant_id: string;
  status: string;
  scheduled_deactivation_time: string | null;
  is_scheduled: boolean;
  view_count?: number;
  order_count?: number;
  total_revenue?: number;
  created_at: string;
  archived_at?: string | null;
}

export interface ArchivedMenu extends ExpiringMenu {
  archived_at: string;
  archived_reason: string;
  analytics_snapshot: MenuAnalyticsSnapshot;
}

export interface MenuAnalyticsSnapshot {
  totalViews: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  archivedAt: string;
}

/**
 * Hook for fetching menus that are expiring soon
 * Shows menus with deactivation time within the specified hours
 */
export const useExpiringSoonMenus = (tenantId: string | undefined, hoursAhead: number = 24) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'expiring-soon', tenantId, hoursAhead],
    queryFn: async () => {
      if (!tenantId) return [];

      const now = new Date();
      const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

      const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: boolean) => { gte: (column: string, value: string) => { lte: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: ExpiringMenu[] | null; error: unknown }> } } } } } } } })
        .from('disposable_menus')
        .select(`
          id, name, tenant_id, status, scheduled_deactivation_time, is_scheduled,
          view_count, created_at
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gte('scheduled_deactivation_time', now.toISOString())
        .lte('scheduled_deactivation_time', futureTime.toISOString())
        .order('scheduled_deactivation_time', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch expiring menus', { error, tenantId });
        return [];
      }

      return (data || []) as ExpiringMenu[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

/**
 * Hook for fetching archived menus with their preserved analytics
 */
export const useArchivedMenus = (tenantId: string | undefined) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'archived', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { in: (column: string, values: string[]) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: ExpiringMenu[] | null; error: unknown }> } } } } })
        .from('disposable_menus')
        .select(`
          id, name, tenant_id, status, scheduled_deactivation_time, is_scheduled,
          view_count, created_at, archived_at, archived_reason, analytics_snapshot
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['archived', 'soft_burned', 'hard_burned'])
        .order('archived_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch archived menus', { error, tenantId });
        return [];
      }

      return (data || []) as ArchivedMenu[];
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook for archiving a menu (preserves analytics)
 */
export const useArchiveMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      menuId,
      reason = 'expired'
    }: {
      menuId: string;
      reason?: 'expired' | 'manual' | 'schedule_ended';
    }) => {
      // First, get the menu's current analytics
      const { data: menu, error: menuError } = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: ExpiringMenu | null; error: unknown }> } } } })
        .from('disposable_menus')
        .select(`
          id, name, tenant_id, status, view_count,
          menu_orders(id, total_amount)
        `)
        .eq('id', menuId)
        .maybeSingle();

      if (menuError || !menu) {
        throw new Error('Menu not found');
      }

      // Calculate analytics snapshot
      const orders = (menu as unknown as { menu_orders?: Array<{ id: string; total_amount?: number }> }).menu_orders || [];
      const totalViews = (menu as unknown as { view_count?: number }).view_count || 0;
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum: number, o: { total_amount?: number }) =>
        sum + Number(o.total_amount || 0), 0);
      const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

      const analyticsSnapshot: MenuAnalyticsSnapshot = {
        totalViews,
        totalOrders,
        totalRevenue,
        conversionRate,
        archivedAt: new Date().toISOString(),
      };

      // Update the menu to archived status
      const { data, error } = await (supabase as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<{ data: ExpiringMenu | null; error: unknown }> } } } } })
        .from('disposable_menus')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_reason: reason,
          analytics_snapshot: analyticsSnapshot,
          is_scheduled: false,
          scheduled_activation_time: null,
          scheduled_deactivation_time: null,
        })
        .eq('id', menuId)
        .select()
        .single();

      if (error) throw error;

      // Log to menu_schedule_history
      await (supabase as unknown as { from: (table: string) => { insert: (values: Record<string, unknown>) => Promise<{ error: unknown }> } })
        .from('menu_schedule_history')
        .insert({
          menu_id: menuId,
          tenant_id: (menu as unknown as { tenant_id: string }).tenant_id,
          action: 'deactivated',
          previous_status: (menu as unknown as { status: string }).status,
          new_status: 'archived',
          metadata: { reason, analyticsSnapshot },
        });

      return { menu: data, analyticsSnapshot };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });

      // Publish event for admin notification
      if (result.menu) {
        publish('menu_published', {
          menuId: variables.menuId,
          tenantId: (result.menu as unknown as { tenant_id: string }).tenant_id,
          publishedAt: new Date().toISOString(),
        });
      }

      showSuccessToast(
        'Menu Archived',
        'Menu has been archived. Analytics data has been preserved.'
      );
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to archive menu', error, { component: 'useMenuExpiration' });
      showErrorToast('Archive Failed', errorMessage);
    },
  });
};

/**
 * Hook for reactivating an archived menu
 */
export const useReactivateMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      menuId,
      newSchedule
    }: {
      menuId: string;
      newSchedule?: {
        activationTime?: string;
        deactivationTime?: string;
        timezone?: string;
      };
    }) => {
      const updateData: Record<string, unknown> = {
        status: 'active',
        archived_at: null,
        archived_reason: null,
      };

      // If new schedule provided, set it up
      if (newSchedule) {
        updateData.is_scheduled = true;
        updateData.scheduled_activation_time = newSchedule.activationTime || null;
        updateData.scheduled_deactivation_time = newSchedule.deactivationTime || null;
        updateData.schedule_timezone = newSchedule.timezone || 'UTC';
      }

      const { data, error } = await (supabase as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: ExpiringMenu | null; error: unknown }> } } } } })
        .from('disposable_menus')
        .update(updateData)
        .eq('id', menuId)
        .select('id, name, tenant_id, status')
        .single();

      if (error) throw error;

      // Log the reactivation
      if (data) {
        await (supabase as unknown as { from: (table: string) => { insert: (values: Record<string, unknown>) => Promise<{ error: unknown }> } })
          .from('menu_schedule_history')
          .insert({
            menu_id: menuId,
            tenant_id: (data as unknown as { tenant_id: string }).tenant_id,
            action: 'activated',
            previous_status: 'archived',
            new_status: 'active',
            scheduled_activation_time: newSchedule?.activationTime,
            scheduled_deactivation_time: newSchedule?.deactivationTime,
            metadata: { reactivated: true, newSchedule },
          });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      showSuccessToast(
        'Menu Reactivated',
        'Menu is now active and accessible to customers.'
      );
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reactivate menu', error, { component: 'useMenuExpiration' });
      showErrorToast('Reactivation Failed', errorMessage);
    },
  });
};

/**
 * Hook for processing expired menus (to be called periodically)
 */
export const useProcessExpiredMenus = (tenantId: string | undefined) => {
  const archiveMenu = useArchiveMenu();
  const queryClient = useQueryClient();

  const processExpired = useCallback(async () => {
    if (!tenantId) return { processed: 0 };

    const now = new Date();

    // Find menus that have passed their deactivation time
    const { data: expiredMenus, error } = await (supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { lt: (column: string, value: string) => { neq: (column: string, value: string) => Promise<{ data: ExpiringMenu[] | null; error: unknown }> } } } } } })
      .from('disposable_menus')
      .select('id, name, scheduled_deactivation_time')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lt('scheduled_deactivation_time', now.toISOString())
      .neq('recurrence_pattern', 'none');

    if (error) {
      logger.error('Failed to fetch expired menus', error, { tenantId });
      return { processed: 0, error };
    }

    const expiredList = expiredMenus || [];
    let processedCount = 0;

    for (const menu of expiredList) {
      try {
        await archiveMenu.mutateAsync({
          menuId: menu.id,
          reason: 'expired'
        });
        processedCount++;
        logger.info('Auto-archived expired menu', {
          menuId: menu.id,
          menuName: menu.name,
          component: 'useMenuExpiration'
        });
      } catch (err) {
        logger.error('Failed to auto-archive menu', err, {
          menuId: menu.id,
          component: 'useMenuExpiration'
        });
      }
    }

    if (processedCount > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
    }

    return { processed: processedCount };
  }, [tenantId, archiveMenu, queryClient]);

  return { processExpired };
};

/**
 * Utility hook for calculating time until expiration
 */
export const useTimeUntilExpiration = (deactivationTime: string | null) => {
  return useMemo(() => {
    if (!deactivationTime) return null;

    const now = new Date();
    const expiry = new Date(deactivationTime);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return { expired: true, hours: 0, minutes: 0, label: 'Expired' };

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let label: string;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      label = `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      label = `${hours}h ${minutes}m`;
    } else {
      label = `${minutes}m`;
    }

    return { expired: false, hours, minutes, label };
  }, [deactivationTime]);
};
