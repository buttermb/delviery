import { logger } from '@/lib/logger';
/**
 * Hook for managing workflow executions with real-time updates
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

interface ExecutionLog {
  status: 'success' | 'error';
  action_type: string;
  duration_ms?: number;
  error?: string;
  result?: Record<string, unknown>;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  tenant_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  execution_log?: ExecutionLog[];
  error_message?: string;
  trigger_data?: Record<string, unknown>;
  workflow?: {
    name: string;
    description?: string;
  };
}

interface ExecutionMetrics {
  total: number;
  completed: number;
  failed: number;
  running: number;
  queued: number;
  cancelled: number;
  avgDuration: number;
  successRate: number;
}

export function useWorkflowExecutions(limit = 50, autoRefresh = false) {
  const { tenant } = useTenantAdminAuth();
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    queued: 0,
    cancelled: 0,
    avgDuration: 0,
    successRate: 0,
  });

  const { data: executions, isLoading, refetch } = useQuery({
    queryKey: queryKeys.workflowExecutions.all,
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          workflow:workflow_definitions(name, description)
        `)
        .eq('tenant_id', tenant.id)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as WorkflowExecution[];
    },
    enabled: !!tenant?.id,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Calculate metrics
  useEffect(() => {
    if (executions && executions.length > 0) {
      const completed = executions.filter((e) => e.status === 'completed').length;
      const failed = executions.filter((e) => e.status === 'failed').length;
      const running = executions.filter((e) => e.status === 'running').length;
      const queued = executions.filter((e) => e.status === 'queued').length;
      const cancelled = executions.filter((e) => e.status === 'cancelled').length;

      const completedExecutions = executions.filter(
        (e) => e.status === 'completed' && e.duration_ms
      );
      const avgDuration =
        completedExecutions.length > 0
          ? completedExecutions.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) /
            completedExecutions.length
          : 0;

      const successRate =
        completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0;

      setMetrics({
        total: executions.length,
        completed,
        failed,
        running,
        queued,
        cancelled,
        avgDuration: Math.round(avgDuration),
        successRate: Math.round(successRate * 10) / 10,
      });
    }
  }, [executions]);

  // Real-time subscriptions
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`workflow-executions-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          logger.debug('Workflow execution change', { payload, component: 'useWorkflowExecutions' });
          refetch();

          // Show toast for status changes
          if (payload.eventType === 'UPDATE') {
            const newExecution = payload.new as WorkflowExecution;
            if (newExecution.status === 'completed') {
              toast.success(`Workflow executed successfully in ${newExecution.duration_ms}ms`);
            } else if (newExecution.status === 'failed') {
              toast.error(newExecution.error_message || 'Workflow execution failed');
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Workflow executions subscription error', { status, component: 'useWorkflowExecutions' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);

  return {
    executions: (executions as WorkflowExecution[]) ?? [],
    metrics,
    isLoading,
    refetch,
  };
}
