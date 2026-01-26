/**
 * Workflow Engine Helper
 * Execute workflows and manage workflow state
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { auditActions } from './auditLog';
import { safeFetch } from '@/utils/safeFetch';

// Type definitions for workflow tables (not yet in generated types)
export interface WorkflowAction {
  id: string;
  type: string;
  config: WorkflowActionConfig;
}

export interface WorkflowActionConfig {
  table?: string;
  data?: Record<string, unknown>;
  id?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  duration?: number;
  condition?: WorkflowCondition;
  thenActions?: WorkflowAction[];
  elseActions?: WorkflowAction[];
}

export interface WorkflowCondition {
  type: 'equals' | 'greater_than' | 'less_than';
  field: string;
  value: unknown;
}

export interface WorkflowExecution {
  workflowId: string;
  tenantId?: string;
  status: 'running' | 'completed' | 'failed';
  executionLog: WorkflowExecutionLogEntry[];
}

export interface WorkflowExecutionLogEntry {
  actionId: string;
  actionType: string;
  status: 'running' | 'completed' | 'failed';
  timestamp: string;
  completedAt?: string;
}

// Database row types for workflow tables (not yet in generated Supabase types)
interface WorkflowRow {
  id: string;
  name: string;
  enabled: boolean;
  actions: WorkflowAction[];
  tenant_id?: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  tenant_id?: string;
  status: 'running' | 'completed' | 'failed';
  execution_log: WorkflowExecutionLogEntry[];
  error_message?: string;
  completed_at?: string;
  created_at: string;
}

interface WorkflowExecutionInsert {
  workflow_id: string;
  tenant_id?: string;
  status: 'running' | 'completed' | 'failed';
  execution_log: WorkflowExecutionLogEntry[];
}

interface WorkflowExecutionUpdate {
  status?: 'running' | 'completed' | 'failed';
  completed_at?: string;
  error_message?: string;
  execution_log?: WorkflowExecutionLogEntry[];
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
  workflowId: string,
  tenantId?: string,
  triggerData?: Record<string, unknown>
): Promise<void> {
  try {
    // Get workflow definition
    // Note: 'workflows' table is not yet in generated types
    const { data: workflow, error: fetchError } = await supabase
      .from('workflows' as 'accounts') // Type assertion for table not in types
      .select('*')
      .eq('id', workflowId)
      .maybeSingle() as unknown as { data: WorkflowRow | null; error: Error | null };

    if (fetchError || !workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }

    // Create execution record
    // Note: 'workflow_executions' table is not yet in generated types
    const insertPayload: WorkflowExecutionInsert = {
      workflow_id: workflowId,
      tenant_id: tenantId,
      status: 'running',
      execution_log: [],
    };

    const { data: execution, error: execError } = await (supabase as any)
      .from('workflow_executions') // Type assertion for table not in types
      .insert(insertPayload)
      .select()
      .maybeSingle() as { data: WorkflowExecutionRow | null; error: Error | null };

    if (execError || !execution) {
      throw new Error('Failed to create execution record');
    }

    const executionLog: WorkflowExecutionLogEntry[] = [];

    try {
      // Execute each action
      const actions = workflow.actions;

      for (const action of actions) {
        executionLog.push({
          actionId: action.id,
          actionType: action.type,
          status: 'running',
          timestamp: new Date().toISOString(),
        });

        await executeAction(action, tenantId, triggerData);

        executionLog[executionLog.length - 1].status = 'completed';
        executionLog[executionLog.length - 1].completedAt = new Date().toISOString();
      }

      // Mark execution as completed
      const completedUpdate: WorkflowExecutionUpdate = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        execution_log: executionLog,
      };

      await supabase
        .from('workflow_executions' as 'accounts')
        .update(completedUpdate as unknown as Record<string, unknown>)
        .eq('id', execution.id);

      // Log audit event
      auditActions.workflowExecuted(workflowId, tenantId);
    } catch (actionError: unknown) {
      // Mark execution as failed
      const errorMessage = actionError instanceof Error ? actionError.message : String(actionError);

      const failedUpdate: WorkflowExecutionUpdate = {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        execution_log: executionLog,
      };

      await supabase
        .from('workflow_executions' as 'accounts')
        .update(failedUpdate as unknown as Record<string, unknown>)
        .eq('id', execution.id);

      throw actionError;
    }
  } catch (error) {
    logger.error('Error executing workflow', error);
    throw error;
  }
}

/**
 * Execute a single workflow action
 */
async function executeAction(
  action: WorkflowAction,
  tenantId?: string,
  triggerData?: Record<string, unknown>
): Promise<void> {
  switch (action.type) {
    case 'send_email':
      // In production, integrate with email service
      logger.debug('Sending email', action.config);
      break;

    case 'create_record':
      // Create database record
      if (action.config.table && action.config.data) {
        const { error } = await (supabase as any)
          .from(action.config.table) // Dynamic table access
          .insert(action.config.data);
        if (error) throw error;
      }
      break;

    case 'update_record':
      // Update database record
      if (action.config.table && action.config.id && action.config.data) {
        const { error } = await (supabase as any)
          .from(action.config.table) // Dynamic table access
          .update(action.config.data)
          .eq('id', action.config.id);
        if (error) throw error;
      }
      break;

    case 'send_webhook':
      // Send HTTP webhook
      if (action.config.url) {
        await safeFetch(action.config.url, {
          method: action.config.method || 'POST',
          headers: action.config.headers || { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...action.config.body,
            tenantId,
            triggerData,
          }),
        });
      }
      break;

    case 'delay':
      // Wait for specified time
      const delayMs = action.config.duration || 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      break;

    case 'conditional':
      // Execute based on condition
      if (action.config.condition) {
        const conditionMet = evaluateCondition(action.config.condition, triggerData);
        if (conditionMet && action.config.thenActions) {
          for (const thenAction of action.config.thenActions) {
            await executeAction(thenAction, tenantId, triggerData);
          }
        } else if (!conditionMet && action.config.elseActions) {
          for (const elseAction of action.config.elseActions) {
            await executeAction(elseAction, tenantId, triggerData);
          }
        }
      }
      break;

    default:
      logger.warn(`Unknown action type: ${action.type}`);
  }
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  condition: WorkflowCondition,
  data?: Record<string, unknown>
): boolean {
  // Simple condition evaluation
  // In production, use a proper expression evaluator
  if (condition.type === 'equals') {
    return data?.[condition.field] === condition.value;
  }
  if (condition.type === 'greater_than') {
    const fieldValue = data?.[condition.field];
    const numericValue = typeof fieldValue === 'number' ? fieldValue : 0;
    return numericValue > (condition.value as number);
  }
  if (condition.type === 'less_than') {
    const fieldValue = data?.[condition.field];
    const numericValue = typeof fieldValue === 'number' ? fieldValue : 0;
    return numericValue < (condition.value as number);
  }
  return false;
}
