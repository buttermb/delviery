import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useInventoryAlertActions() {
  const queryClient = useQueryClient();

  const snoozeAlert = useMutation({
    mutationFn: async ({ alertId, hours = 24 }: { alertId: string; hours?: number }) => {
      const { data, error } = await supabase.rpc('snooze_inventory_alert', {
        p_alert_id: alertId,
        p_snooze_hours: hours
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Alert snoozed for ${variables.hours} hours`);
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to snooze alert', { description: error.message });
    }
  });

  const dismissAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase.rpc('dismiss_inventory_alert', {
        p_alert_id: alertId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Alert dismissed');
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to dismiss alert', { description: error.message });
    }
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase.rpc('resolve_inventory_alert', {
        alert_id: alertId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Alert resolved');
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to resolve alert', { description: error.message });
    }
  });

  return {
    snoozeAlert: snoozeAlert.mutate,
    dismissAlert: dismissAlert.mutate,
    resolveAlert: resolveAlert.mutate,
    isSnoozing: snoozeAlert.isPending,
    isDismissing: dismissAlert.isPending,
    isResolving: resolveAlert.isPending
  };
}
