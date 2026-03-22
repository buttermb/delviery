import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

import {
  getWorkflowActionCreditKey,
  getWorkflowActionsCreditBreakdown,
  calculateWorkflowTotalCredits,
} from '../workflowCreditCosts';

describe('getWorkflowActionCreditKey', () => {
  it('maps send_email to send_email', () => {
    expect(getWorkflowActionCreditKey('send_email')).toBe('send_email');
  });

  it('maps send_sms to send_sms', () => {
    expect(getWorkflowActionCreditKey('send_sms')).toBe('send_sms');
  });

  it('maps call_webhook to webhook_fired', () => {
    expect(getWorkflowActionCreditKey('call_webhook')).toBe('webhook_fired');
  });

  it('maps update_inventory to stock_update', () => {
    expect(getWorkflowActionCreditKey('update_inventory')).toBe('stock_update');
  });

  it('maps assign_courier to courier_assign_delivery', () => {
    expect(getWorkflowActionCreditKey('assign_courier')).toBe('courier_assign_delivery');
  });

  it('maps database_query to data_warehouse_query', () => {
    expect(getWorkflowActionCreditKey('database_query')).toBe('data_warehouse_query');
  });

  it('returns null for unmapped action types', () => {
    expect(getWorkflowActionCreditKey('unknown_action')).toBeNull();
  });

  it('normalises spaces and dashes to underscores', () => {
    expect(getWorkflowActionCreditKey('send email')).toBe('send_email');
    expect(getWorkflowActionCreditKey('Send-Email')).toBe('send_email');
  });
});

describe('getWorkflowActionsCreditBreakdown', () => {
  it('returns correct breakdown for known actions', () => {
    const actions = [
      { type: 'send_email' },
      { type: 'send_sms' },
    ];

    const result = getWorkflowActionsCreditBreakdown(actions);

    expect(result).toHaveLength(2);
    expect(result[0].creditKey).toBe('send_email');
    expect(result[0].credits).toBe(10);
    expect(result[1].creditKey).toBe('send_sms');
    expect(result[1].credits).toBe(25);
  });

  it('returns 0 credits and null key for unknown actions', () => {
    const actions = [{ type: 'some_custom_action' }];

    const result = getWorkflowActionsCreditBreakdown(actions);

    expect(result).toHaveLength(1);
    expect(result[0].creditKey).toBeNull();
    expect(result[0].credits).toBe(0);
    expect(result[0].actionName).toBe('some_custom_action');
  });

  it('returns empty array for empty actions', () => {
    expect(getWorkflowActionsCreditBreakdown([])).toEqual([]);
  });
});

describe('calculateWorkflowTotalCredits', () => {
  it('sums credits for all actions', () => {
    const actions = [
      { type: 'send_email' },   // 10
      { type: 'send_sms' },     // 25
      { type: 'call_webhook' }, // 5
    ];

    expect(calculateWorkflowTotalCredits(actions)).toBe(40);
  });

  it('returns 0 for empty action list', () => {
    expect(calculateWorkflowTotalCredits([])).toBe(0);
  });

  it('returns 0 when all actions are unmapped', () => {
    const actions = [{ type: 'unknown_a' }, { type: 'unknown_b' }];
    expect(calculateWorkflowTotalCredits(actions)).toBe(0);
  });

  it('handles mix of mapped and unmapped actions', () => {
    const actions = [
      { type: 'send_email' },     // 10
      { type: 'unknown_action' }, // 0
      { type: 'send_sms' },       // 25
    ];
    expect(calculateWorkflowTotalCredits(actions)).toBe(35);
  });
});
