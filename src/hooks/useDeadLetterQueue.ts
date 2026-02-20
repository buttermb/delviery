/**
 * Dead Letter Queue Hook
 * Manages failed workflow executions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

export interface DeadLetterEntry {
  id: string;
  workflow_execution_id: string;
  workflow_id: string;
  tenant_id: string;
  trigger_data: Record<string, unknown>;
  execution_log: Array<Record<string, unknown>>;
  error_type: string;
  error_message: string;
  error_stack?: string;
  error_details?: Record<string, unknown>;
  total_attempts: number;
  first_failed_at: string;
  last_attempt_at: string;
  status: 'failed' | 'retrying' | 'resolved' | 'ignored';
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  manual_retry_requested: boolean;
  created_at: string;
  updated_at: string;
  workflow: {
    name: string;
    description?: string;
  };
}

export function useDeadLetterQueue() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery<DeadLetterEntry[]>({
    queryKey: ['dead-letter-queue', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('workflow_dead_letter_queue')
        .select(`
          *,
          workflow:workflow_definitions(name, description)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeadLetterEntry[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const retryExecution = useMutation({
    mutationFn: async (dlqId: string) => {
      const { data, error } = await supabase.rpc('retry_from_dead_letter_queue', {
        p_dlq_id: dlqId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-letter-queue'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
      toast.success('Workflow execution queued for retry');
    },
    onError: (error: unknown) => {
      toast.error(humanizeError(error, 'Failed to retry execution'));
    },
  });

  const resolveEntry = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase.rpc('resolve_dead_letter_entry', {
        p_dlq_id: id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_notes: notes
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-letter-queue'] });
      toast.success('Entry marked as resolved');
    },
    onError: (error: unknown) => {
      toast.error(humanizeError(error, 'Failed to resolve entry'));
    },
  });

  const ignoreEntry = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('workflow_dead_letter_queue')
        .update({
          status: 'ignored',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolution_notes: notes
        })
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-letter-queue'] });
      toast.success('Entry ignored');
    },
    onError: (error: unknown) => {
      toast.error(humanizeError(error, 'Failed to ignore entry'));
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('workflow_dead_letter_queue')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-letter-queue'] });
      toast.success('Entry deleted');
    },
    onError: (error: unknown) => {
      toast.error(humanizeError(error, 'Failed to delete entry'));
    },
  });

  const stats = {
    total: entries?.length || 0,
    failed: entries?.filter(e => e.status === 'failed').length || 0,
    retrying: entries?.filter(e => e.status === 'retrying').length || 0,
    resolved: entries?.filter(e => e.status === 'resolved').length || 0,
    ignored: entries?.filter(e => e.status === 'ignored').length || 0,
  };

  return {
    entries: entries || [],
    isLoading,
    stats,
    retryExecution,
    resolveEntry,
    ignoreEntry,
    deleteEntry,
  };
}
