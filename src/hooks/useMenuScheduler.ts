import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { queryKeys } from '@/lib/queryKeys';
import { ADMIN_PANEL_QUERY_CONFIG } from '@/lib/react-query-config';

export interface MenuSchedule {
  id: string;
  menuId: string;
  scheduledActivationTime: string | null;
  scheduledDeactivationTime: string | null;
  isScheduled: boolean;
  scheduleTimezone: string;
  recurrencePattern: 'none' | 'daily' | 'weekly' | 'monthly' | null;
  recurrenceConfig: Record<string, unknown>;
}

export interface MenuScheduleHistoryEntry {
  id: string;
  menuId: string;
  tenantId: string;
  action: string;
  scheduledActivationTime: string | null;
  scheduledDeactivationTime: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  recurrencePattern: string | null;
  executedBy: string | null;
  executedAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Hook to fetch schedule for a specific menu
 */
export const useMenuSchedule = (menuId?: string) => {
  return useQuery({
    queryKey: queryKeys.menuSchedule.byMenu(menuId),
    queryFn: async () => {
      if (!menuId) return null;

      const { data, error } = await supabase
        .from('disposable_menus')
        .select(`
          id,
          scheduled_activation_time,
          scheduled_deactivation_time,
          is_scheduled,
          schedule_timezone,
          recurrence_pattern,
          recurrence_config
        `)
        .eq('id', menuId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch menu schedule', { error, menuId });
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id as string,
        menuId: data.id as string,
        scheduledActivationTime: data.scheduled_activation_time as string | null,
        scheduledDeactivationTime: data.scheduled_deactivation_time as string | null,
        isScheduled: data.is_scheduled as boolean,
        scheduleTimezone: (data.schedule_timezone as string) || 'UTC',
        recurrencePattern: data.recurrence_pattern as MenuSchedule['recurrencePattern'],
        recurrenceConfig: (data.recurrence_config as Record<string, unknown>) || {},
      } as MenuSchedule;
    },
    enabled: !!menuId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch schedule history for a menu
 */
export const useMenuScheduleHistory = (menuId?: string) => {
  return useQuery({
    queryKey: queryKeys.menuSchedule.history(menuId),
    queryFn: async () => {
      if (!menuId) return [];

      const { data, error } = await supabase
        .from('menu_schedule_history')
        .select('id, menu_id, tenant_id, action, scheduled_activation_time, scheduled_deactivation_time, previous_status, new_status, recurrence_pattern, executed_by, executed_at, metadata')
        .eq('menu_id', menuId)
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch menu schedule history', { error, menuId });
        return [];
      }

      return (data ?? []).map((entry) => ({
        id: entry.id as string,
        menuId: entry.menu_id as string,
        tenantId: entry.tenant_id as string,
        action: entry.action as string,
        scheduledActivationTime: entry.scheduled_activation_time as string | null,
        scheduledDeactivationTime: entry.scheduled_deactivation_time as string | null,
        previousStatus: entry.previous_status as string | null,
        newStatus: entry.new_status as string | null,
        recurrencePattern: entry.recurrence_pattern as string | null,
        executedBy: entry.executed_by as string | null,
        executedAt: entry.executed_at as string,
        metadata: (entry.metadata as Record<string, unknown>) || {},
      })) as MenuScheduleHistoryEntry[];
    },
    enabled: !!menuId,
    staleTime: 60 * 1000,
    gcTime: ADMIN_PANEL_QUERY_CONFIG.gcTime, // 20 minutes for admin queries
  });
};

/**
 * Hook to update menu schedule
 */
export const useUpdateMenuSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleData: {
      menuId: string;
      tenantId: string;
      activationTime: string | null;
      deactivationTime: string | null;
      isScheduled: boolean;
      timezone: string;
      recurrencePattern: string;
      recurrenceConfig?: Record<string, unknown>;
    }) => {
      const { menuId, tenantId, activationTime, deactivationTime, isScheduled, timezone, recurrencePattern, recurrenceConfig } = scheduleData;

      // Update menu schedule
      const { data, error } = await supabase
        .from('disposable_menus')
        .update({
          scheduled_activation_time: activationTime,
          scheduled_deactivation_time: deactivationTime,
          is_scheduled: isScheduled,
          schedule_timezone: timezone,
          recurrence_pattern: recurrencePattern === 'none' ? null : recurrencePattern,
          recurrence_config: recurrenceConfig || {},
        })
        .eq('id', menuId)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      // Log the schedule update
      await supabase
        .from('menu_schedule_history')
        .insert({
          menu_id: menuId,
          tenant_id: tenantId,
          action: isScheduled ? 'scheduled' : 'schedule_cancelled',
          scheduled_activation_time: activationTime,
          scheduled_deactivation_time: deactivationTime,
          recurrence_pattern: recurrencePattern === 'none' ? null : recurrencePattern,
          metadata: { timezone },
        });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.disposableMenus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.menuSchedule.byMenu(variables.menuId) });

      if (variables.isScheduled) {
        showSuccessToast(
          'Schedule Updated',
          variables.activationTime
            ? `Menu scheduled to activate on ${new Date(variables.activationTime).toLocaleDateString()}`
            : 'Menu schedule updated'
        );
      } else {
        showSuccessToast('Schedule Cancelled', 'Menu scheduling has been disabled');
      }
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Menu schedule update failed', { error, errorMessage });
      showErrorToast('Schedule Update Failed', errorMessage);
    },
  });
};

/**
 * Hook to cancel menu schedule
 */
export const useCancelMenuSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, tenantId }: { menuId: string; tenantId: string }) => {
      const { data, error } = await supabase
        .from('disposable_menus')
        .update({
          is_scheduled: false,
          scheduled_activation_time: null,
          scheduled_deactivation_time: null,
          recurrence_pattern: null,
          recurrence_config: {},
        })
        .eq('id', menuId)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      // Log the cancellation
      await supabase
        .from('menu_schedule_history')
        .insert({
          menu_id: menuId,
          tenant_id: tenantId,
          action: 'schedule_cancelled',
          metadata: { reason: 'manual_cancellation' },
        });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.disposableMenus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.menuSchedule.byMenu(variables.menuId) });
      showSuccessToast('Schedule Cancelled', 'Menu scheduling has been disabled');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Menu schedule cancellation failed', { error, errorMessage });
      showErrorToast('Cancellation Failed', errorMessage);
    },
  });
};

/**
 * Hook to get scheduled menus for a tenant
 */
export const useScheduledMenus = (tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'scheduled', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select(`
          id,
          name,
          status,
          scheduled_activation_time,
          scheduled_deactivation_time,
          is_scheduled,
          schedule_timezone,
          recurrence_pattern
        `)
        .eq('tenant_id', tenantId)
        .eq('is_scheduled', true)
        .order('scheduled_activation_time', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch scheduled menus', { error, tenantId });
        return [];
      }

      return (data ?? []).map((menu) => ({
        id: menu.id as string,
        name: menu.name as string,
        status: menu.status as string,
        scheduledActivationTime: menu.scheduled_activation_time as string | null,
        scheduledDeactivationTime: menu.scheduled_deactivation_time as string | null,
        isScheduled: menu.is_scheduled as boolean,
        scheduleTimezone: (menu.schedule_timezone as string) || 'UTC',
        recurrencePattern: menu.recurrence_pattern as string | null,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
