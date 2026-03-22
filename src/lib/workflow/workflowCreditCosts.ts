/**
 * Workflow Credit Cost Utilities
 *
 * Maps workflow action types to credit action keys and calculates
 * total credit costs for a workflow's action list.
 */

import { getCreditCost, getCreditCostInfo } from '@/lib/credits';

/**
 * Maps a workflow action type string (from workflow_action_templates)
 * to the corresponding credit action key in CREDIT_COSTS.
 *
 * Returns null if the action type has no mapped credit cost.
 */
export function getWorkflowActionCreditKey(actionType: string): string | null {
  const normalised = actionType.toLowerCase().replace(/[\s-]+/g, '_');

  const mapping: Record<string, string> = {
    send_email: 'send_email',
    send_sms: 'send_sms',
    send_push_notification: 'send_push_notification',
    call_webhook: 'webhook_fired',
    webhook: 'webhook_fired',
    update_inventory: 'stock_update',
    assign_courier: 'courier_assign_delivery',
    database_query: 'data_warehouse_query',
    create_order: 'order_create_manual',
    create_invoice: 'invoice_create',
    send_notification: 'send_email',
    generate_report: 'report_custom_generate',
    ai_suggestion: 'ai_suggestions',
  };

  return mapping[normalised] ?? null;
}

export interface WorkflowActionCreditInfo {
  actionType: string;
  creditKey: string | null;
  credits: number;
  actionName: string;
}

/**
 * Returns per-action credit breakdown for a list of workflow actions.
 */
export function getWorkflowActionsCreditBreakdown(
  actions: ReadonlyArray<{ type: string }>
): WorkflowActionCreditInfo[] {
  return actions.map((action) => {
    const creditKey = getWorkflowActionCreditKey(action.type);
    const cost = creditKey ? getCreditCost(creditKey) : 0;
    const info = creditKey ? getCreditCostInfo(creditKey) : null;

    return {
      actionType: action.type,
      creditKey,
      credits: cost,
      actionName: info?.actionName ?? action.type,
    };
  });
}

/**
 * Calculates the total credit cost for a single execution of a workflow.
 */
export function calculateWorkflowTotalCredits(
  actions: ReadonlyArray<{ type: string }>
): number {
  return getWorkflowActionsCreditBreakdown(actions).reduce(
    (sum, item) => sum + item.credits,
    0
  );
}
