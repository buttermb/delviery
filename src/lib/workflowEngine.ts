// Mock workflow engine until tables are created
import { auditActions } from './auditLog';

export async function executeWorkflow(
  workflowId: string,
  tenantId?: string,
  triggerData?: Record<string, any>
): Promise<void> {
  console.log('Executing workflow:', { workflowId, tenantId, triggerData });
  await auditActions.workflowExecuted(workflowId);
}

export async function executeAction(action: any, tenantId?: string, triggerData?: Record<string, any>): Promise<void> {
  console.log('Executing action:', { action, tenantId, triggerData });
}

export function evaluateCondition(condition: any, data?: Record<string, any>): boolean {
  return true;
}
