import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

/**
 * Hook to soft delete and restore wholesale clients
 */
export function useSoftDeleteClient() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  const softDeleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase.rpc('soft_delete_wholesale_client', {
        p_client_id: clientId,
        p_tenant_id: tenant.id
      });

      if (error) throw error;
      if (!data) throw new Error('Client not found or already archived');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });
      showSuccessToast('Client Archived', 'Client has been archived successfully');
    },
    onError: (error) => {
      showErrorToast('Archive Failed', error instanceof Error ? error.message : 'Failed to archive client');
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase.rpc('restore_wholesale_client', {
        p_client_id: clientId,
        p_tenant_id: tenant.id
      });

      if (error) throw error;
      if (!data) throw new Error('Client not found or already active');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });
      showSuccessToast('Client Restored', 'Client has been restored successfully');
    },
    onError: (error) => {
      showErrorToast('Restore Failed', error instanceof Error ? error.message : 'Failed to restore client');
    }
  });

  return {
    softDelete: softDeleteMutation.mutate,
    restore: restoreMutation.mutate,
    isSoftDeleting: softDeleteMutation.isPending,
    isRestoring: restoreMutation.isPending
  };
}

export default useSoftDeleteClient;
