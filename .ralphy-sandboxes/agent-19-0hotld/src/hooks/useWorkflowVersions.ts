/**
 * Hook for managing workflow versions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface WorkflowAction {
  id?: string;
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WorkflowCondition {
  id?: string;
  type?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  tenant_id: string;
  version_number: number;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  change_summary?: string;
  change_details?: Record<string, unknown>;
  restored_from_version?: number;
}

export function useWorkflowVersions(workflowId: string | null) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useQuery<WorkflowVersion[]>({
    queryKey: queryKeys.workflowVersions.byWorkflow(workflowId, tenant?.id),
    queryFn: async () => {
      if (!workflowId || !tenant?.id) return [];

      const { data, error } = await supabase
        .from('workflow_versions')
        .select('id, workflow_id, tenant_id, version_number, name, description, trigger_type, trigger_config, actions, conditions, is_active, created_by, created_at, change_summary, change_details, restored_from_version')
        .eq('workflow_id', workflowId)
        .eq('tenant_id', tenant.id)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return (data as WorkflowVersion[]) ?? [];
    },
    enabled: !!workflowId && !!tenant?.id,
  });

  const restoreVersion = useMutation({
    mutationFn: async ({
      workflowId,
      versionNumber,
    }: {
      workflowId: string;
      versionNumber: number;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('restore_workflow_version', {
        p_workflow_id: workflowId,
        p_version_number: versionNumber,
        p_tenant_id: tenant.id,
      });

      if (error) throw error;
      
      interface RestoreResponse {
        success?: boolean;
        error?: string;
      }
      
      if (data && !(data as RestoreResponse).success) {
        throw new Error((data as RestoreResponse).error || 'Failed to restore version');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowVersions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      toast.success(`Successfully restored to version ${variables.versionNumber}`);
    },
    onError: (error: unknown) => {
      toast.error('Failed to restore version', { description: humanizeError(error) });
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
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase.rpc('compare_workflow_versions', {
        p_workflow_id: workflowId,
        p_version_a: versionA,
        p_version_b: versionB,
        p_tenant_id: tenant.id,
      });

      if (error) throw error;
      return data;
    },
    onError: (error: unknown) => {
      logger.error('Failed to compare workflow versions', { error });
      toast.error('Failed to compare versions', { description: humanizeError(error) });
    },
  });

  return {
    versions: versions ?? [],
    isLoading,
    restoreVersion,
    compareVersions,
  };
}

export function useWorkflowVersionStats(workflowId: string | null) {
  const { tenant } = useTenantAdminAuth();

  const { data: versions } = useQuery<WorkflowVersion[]>({
    queryKey: queryKeys.workflowVersions.byWorkflow(workflowId, tenant?.id),
    queryFn: async () => {
      if (!workflowId || !tenant?.id) return [];

      const { data, error } = await supabase
        .from('workflow_versions')
        .select('id, workflow_id, tenant_id, version_number, name, description, trigger_type, trigger_config, actions, conditions, is_active, created_by, created_at, change_summary, change_details, restored_from_version')
        .eq('workflow_id', workflowId)
        .eq('tenant_id', tenant.id)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return (data as WorkflowVersion[]) ?? [];
    },
    enabled: !!workflowId && !!tenant?.id,
  });

  const stats = {
    totalVersions: versions?.length ?? 0,
    latestVersion: versions?.[0]?.version_number ?? 0,
    lastUpdated: versions?.[0]?.created_at,
    restoredCount: versions?.filter((v) => v.restored_from_version).length ?? 0,
  };

  return stats;
}
