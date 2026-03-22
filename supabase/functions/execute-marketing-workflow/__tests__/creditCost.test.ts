/**
 * Tests for marketing workflow credit cost calculation.
 *
 * Verifies that calculateWorkflowCreditCost correctly computes the total
 * credit cost and per-action breakdown for various workflow configurations.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateWorkflowCreditCost,
  WORKFLOW_ACTION_CREDIT_COSTS,
} from '../creditCost';

describe('calculateWorkflowCreditCost', () => {
  it('calculates cost for a single send_email action', () => {
    const actions = [{ type: 'send_email' }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(8);
    expect(result.costBreakdown).toEqual([{ action: 'send_email', cost: 8 }]);
  });

  it('calculates cost for a single send_sms action', () => {
    const actions = [{ type: 'send_sms' }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(20);
    expect(result.costBreakdown).toEqual([{ action: 'send_sms', cost: 20 }]);
  });

  it('returns zero cost for free actions (add_tag, wait, condition)', () => {
    const actions = [
      { type: 'add_tag' },
      { type: 'wait' },
      { type: 'condition' },
    ];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(0);
    expect(result.costBreakdown).toEqual([
      { action: 'add_tag', cost: 0 },
      { action: 'wait', cost: 0 },
      { action: 'condition', cost: 0 },
    ]);
  });

  it('calculates cost for award_points action', () => {
    const actions = [{ type: 'award_points' }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(15);
    expect(result.costBreakdown).toEqual([{ action: 'award_points', cost: 15 }]);
  });

  it('calculates cost for send_push action', () => {
    const actions = [{ type: 'send_push' }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(15);
    expect(result.costBreakdown).toEqual([{ action: 'send_push', cost: 15 }]);
  });

  it('sums costs for a mixed workflow', () => {
    const actions = [
      { type: 'send_email' },
      { type: 'send_sms' },
      { type: 'add_tag' },
      { type: 'award_points' },
    ];
    const result = calculateWorkflowCreditCost(actions);

    // 8 + 20 + 0 + 15 = 43
    expect(result.totalCost).toBe(43);
    expect(result.costBreakdown).toHaveLength(4);
    expect(result.costBreakdown).toEqual([
      { action: 'send_email', cost: 8 },
      { action: 'send_sms', cost: 20 },
      { action: 'add_tag', cost: 0 },
      { action: 'award_points', cost: 15 },
    ]);
  });

  it('handles a complex workflow with duplicates', () => {
    const actions = [
      { type: 'send_email' },
      { type: 'wait' },
      { type: 'send_email' },
      { type: 'send_sms' },
      { type: 'add_tag' },
      { type: 'send_push' },
    ];
    const result = calculateWorkflowCreditCost(actions);

    // 8 + 0 + 8 + 20 + 0 + 15 = 51
    expect(result.totalCost).toBe(51);
    expect(result.costBreakdown).toHaveLength(6);
  });

  it('returns zero cost for an empty actions array', () => {
    const result = calculateWorkflowCreditCost([]);

    expect(result.totalCost).toBe(0);
    expect(result.costBreakdown).toEqual([]);
  });

  it('assigns zero cost to unknown action types', () => {
    const actions = [
      { type: 'custom_webhook' },
      { type: 'unknown_action' },
    ];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(0);
    expect(result.costBreakdown).toEqual([
      { action: 'custom_webhook', cost: 0 },
      { action: 'unknown_action', cost: 0 },
    ]);
  });

  it('handles actions with missing type field (coalesces to "unknown")', () => {
    const actions = [{ name: 'something' }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(0);
    // ?? 'unknown' coalesces undefined to 'unknown'
    expect(result.costBreakdown).toEqual([{ action: 'unknown', cost: 0 }]);
  });

  it('handles actions with null type (coalesces to "unknown")', () => {
    const actions = [{ type: null }];
    const result = calculateWorkflowCreditCost(actions);

    expect(result.totalCost).toBe(0);
    // ?? 'unknown' coalesces null to 'unknown'
    expect(result.costBreakdown).toEqual([{ action: 'unknown', cost: 0 }]);
  });
});

describe('WORKFLOW_ACTION_CREDIT_COSTS', () => {
  it('has correct costs for all documented action types', () => {
    expect(WORKFLOW_ACTION_CREDIT_COSTS.send_email).toBe(8);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.send_sms).toBe(20);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.add_tag).toBe(0);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.award_points).toBe(15);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.send_push).toBe(15);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.wait).toBe(0);
    expect(WORKFLOW_ACTION_CREDIT_COSTS.condition).toBe(0);
  });

  it('has exactly the expected number of action types', () => {
    expect(Object.keys(WORKFLOW_ACTION_CREDIT_COSTS)).toHaveLength(7);
  });
});
