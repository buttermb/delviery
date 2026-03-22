/**
 * Credit cost calculation for marketing workflow actions.
 *
 * Uses bulk rates where applicable since workflows execute batches.
 */

export const WORKFLOW_ACTION_CREDIT_COSTS: Record<string, number> = {
  send_email: 8,     // bulk email rate
  send_sms: 20,      // bulk SMS rate
  add_tag: 0,        // free CRM metadata operation
  award_points: 15,  // loyalty reward issuance
  send_push: 15,     // push notification
  wait: 0,           // delay step, no cost
  condition: 0,      // branching logic, no cost
};

export interface CostBreakdownEntry {
  action: string;
  cost: number;
}

export interface WorkflowCreditCost {
  totalCost: number;
  costBreakdown: CostBreakdownEntry[];
}

/**
 * Calculate total credit cost for a set of workflow actions.
 */
export function calculateWorkflowCreditCost(
  actions: Array<Record<string, unknown>>
): WorkflowCreditCost {
  const costBreakdown: CostBreakdownEntry[] = [];
  let totalCost = 0;

  for (const action of actions) {
    const actionType = String(action.type ?? 'unknown');
    const cost = WORKFLOW_ACTION_CREDIT_COSTS[actionType] ?? 0;
    costBreakdown.push({ action: actionType, cost });
    totalCost += cost;
  }

  return { totalCost, costBreakdown };
}
