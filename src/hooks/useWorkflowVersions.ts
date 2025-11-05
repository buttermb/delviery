/**
 * Hook for managing workflow versions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useToast } from '@/hooks/use-toast';

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  tenant_id: string;
  version_number: number;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: any;
  actions: any[];
  conditions?: any[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  change_summary?: string;
  change_details?: any;
  restored_from_version?: number;
}

export function useWorkflowVersions(workflowId: string | null) {
  const { tenant } = useTenantAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useQuery<WorkflowVersion[]>({
    queryKey: ['workflow-versions', workflowId],
    queryFn: async () => {
      if (!workflowId) return [];

      const { data, error } = await supabase
        .from('workflow_versions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!workflowId,
  });

  const restoreVersion = useMutation({
    mutationFn: async ({
      workflowId,
      versionNumber,
    }: {
      workflowId: string;
      versionNumber: number;
    }) => {
      const { data, error } = await supabase.rpc('restore_workflow_version', {
        p_workflow_id: workflowId,
        p_version_number: versionNumber,
      });

      if (error) throw error;
      
      if (data && !(data as any).success) {
        throw new Error((data as any).error || 'Failed to restore version');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-versions'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({
        title: 'Version Restored',
        description: `Successfully restored to version ${variables.versionNumber}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore version',
        variant: 'destructive',
      });
    },
  });

  const compareVersions = useMutation({
    mutationFn: async ({
      workflowId,
      versionA,
      versionB,
    }: {
      workflowId: string;
      versionA: number;
      versionB: number;
    }) => {
      const { data, error } = await supabase.rpc('compare_workflow_versions', {
        p_workflow_id: workflowId,
        p_version_a: versionA,
        p_version_b: versionB,
      });

      if (error) throw error;
      return data;
    },
  });

  return {
    versions: versions || [],
    isLoading,
    restoreVersion,
    compareVersions,
  };
}

export function useWorkflowVersionStats(workflowId: string | null) {
  const { data: versions } = useQuery<WorkflowVersion[]>({
    queryKey: ['workflow-versions', workflowId],
    queryFn: async () => {
      if (!workflowId) return [];

      const { data, error } = await supabase
        .from('workflow_versions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!workflowId,
  });

  const stats = {
    totalVersions: versions?.length || 0,
    latestVersion: versions?.[0]?.version_number || 0,
    lastUpdated: versions?.[0]?.created_at,
    restoredCount: versions?.filter((v: any) => v.restored_from_version).length || 0,
  };

  return stats;
}
