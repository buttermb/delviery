/**
 * Workflow Engine Helper
 * Execute workflows and manage workflow state
 */

import { supabase } from '@/integrations/supabase/client';
import { auditActions } from './auditLog';
import { logger } from '@/utils/logger';
import { safeFetch } from '@/utils/safeFetch';

export interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, any>;
}

export interface WorkflowExecution {
  workflowId: string;
  tenantId?: string;
  status: 'running' | 'completed' | 'failed';
  executionLog: any[];
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
  workflowId: string,
  tenantId?: string,
  triggerData?: Record<string, any>
): Promise<void> {
  try {
    // Get workflow definition
    // @ts-ignore - workflows table not in types yet
    const { data: workflow, error: fetchError } = await supabase
      // @ts-ignore
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .maybeSingle();

    if (fetchError || !workflow) {
      throw new Error('Workflow not found');
    }

    // @ts-ignore - workflow object from non-existent table
    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }

    // Create execution record
    // @ts-ignore - workflow_executions table not in types yet
    const { data: execution, error: execError } = await supabase
      // @ts-ignore
      .from('workflow_executions')
      .insert({
        workflow_id: workflowId,
        tenant_id: tenantId,
        status: 'running',
        execution_log: [],
      })
      .select()
      .single();

    if (execError || !execution) {
      throw new Error('Failed to create execution record');
    }

    const executionLog: any[] = [];

    try {
      // Execute each action
      // @ts-ignore - workflow object from non-existent table
      const actions = workflow.actions as WorkflowAction[];
      
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
      // @ts-ignore - workflow_executions table not in types yet
      await supabase
        // @ts-ignore
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          execution_log: executionLog,
        })
        .eq('id', execution.id);

      // Log audit event
      auditActions.workflowExecuted(workflowId, tenantId);
    } catch (actionError: any) {
      // Mark execution as failed
      // @ts-ignore - workflow_executions table not in types yet
      await supabase
        // @ts-ignore
        .from('workflow_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: actionError.message,
          execution_log: executionLog,
        })
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
  triggerData?: Record<string, any>
): Promise<void> {
  switch (action.type) {
    case 'send_email':
      // In production, integrate with email service
      logger.debug('Sending email', action.config);
      break;

    case 'create_record':
      // Create database record
      if (action.config.table && action.config.data) {
        const { error } = await supabase
          .from(action.config.table)
          .insert(action.config.data);
        if (error) throw error;
      }
      break;

    case 'update_record':
      // Update database record
      if (action.config.table && action.config.id && action.config.data) {
        const { error } = await supabase
          .from(action.config.table)
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
function evaluateCondition(condition: any, data?: Record<string, any>): boolean {
  // Simple condition evaluation
  // In production, use a proper expression evaluator
  if (condition.type === 'equals') {
    return data?.[condition.field] === condition.value;
  }
  if (condition.type === 'greater_than') {
    return (data?.[condition.field] || 0) > condition.value;
  }
  if (condition.type === 'less_than') {
    return (data?.[condition.field] || 0) < condition.value;
  }
  return false;
}

