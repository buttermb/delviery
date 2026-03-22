/**
 * Automation Credit Costs Tests
 *
 * Verifies that automation-related credit costs are correctly defined
 * and that the calculateAutomationCreditCost helper produces accurate totals.
 */

import { describe, it, expect } from 'vitest';
import {
  CREDIT_COSTS,
  AUTOMATION_ACTION_CREDIT_MAP,
  calculateAutomationCreditCost,
  getCreditCost,
  isActionFree,
} from '../creditCosts';

describe('Automation credit cost entries', () => {
  it('automation_run should cost 10 credits', () => {
    expect(CREDIT_COSTS.automation_run).toBeDefined();
    expect(CREDIT_COSTS.automation_run.credits).toBe(10);
    expect(CREDIT_COSTS.automation_run.category).toBe('integrations');
  });

  it('automation_action_send_email should cost 10 credits', () => {
    expect(CREDIT_COSTS.automation_action_send_email).toBeDefined();
    expect(CREDIT_COSTS.automation_action_send_email.credits).toBe(10);
  });

  it('automation_action_send_sms should cost 25 credits', () => {
    expect(CREDIT_COSTS.automation_action_send_sms).toBeDefined();
    expect(CREDIT_COSTS.automation_action_send_sms.credits).toBe(25);
  });

  it('automation_action_create_task should cost 5 credits', () => {
    expect(CREDIT_COSTS.automation_action_create_task).toBeDefined();
    expect(CREDIT_COSTS.automation_action_create_task.credits).toBe(5);
  });

  it('automation_action_update_status should be free (0 credits)', () => {
    expect(CREDIT_COSTS.automation_action_update_status).toBeDefined();
    expect(CREDIT_COSTS.automation_action_update_status.credits).toBe(0);
    expect(isActionFree('automation_action_update_status')).toBe(true);
  });
});

describe('AUTOMATION_ACTION_CREDIT_MAP', () => {
  it('maps send_email to automation_action_send_email', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.send_email).toBe('automation_action_send_email');
  });

  it('maps send_sms to automation_action_send_sms', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.send_sms).toBe('automation_action_send_sms');
  });

  it('maps create_task to automation_action_create_task', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.create_task).toBe('automation_action_create_task');
  });

  it('maps update_status to automation_action_update_status', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.update_status).toBe('automation_action_update_status');
  });

  it('maps low_stock_alert to alert_triggered', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.low_stock_alert).toBe('alert_triggered');
  });

  it('maps daily_revenue_summary to automation_run', () => {
    expect(AUTOMATION_ACTION_CREDIT_MAP.daily_revenue_summary).toBe('automation_run');
  });

  it('all mapped action keys exist in CREDIT_COSTS', () => {
    for (const [, creditKey] of Object.entries(AUTOMATION_ACTION_CREDIT_MAP)) {
      expect(CREDIT_COSTS[creditKey]).toBeDefined();
    }
  });
});

describe('calculateAutomationCreditCost', () => {
  it('returns base cost (10) for empty action list', () => {
    expect(calculateAutomationCreditCost([])).toBe(10);
  });

  it('calculates cost for a single send_email action', () => {
    // base (10) + send_email (10) = 20
    expect(calculateAutomationCreditCost(['send_email'])).toBe(20);
  });

  it('calculates cost for a single send_sms action', () => {
    // base (10) + send_sms (25) = 35
    expect(calculateAutomationCreditCost(['send_sms'])).toBe(35);
  });

  it('calculates cost for a single create_task action', () => {
    // base (10) + create_task (5) = 15
    expect(calculateAutomationCreditCost(['create_task'])).toBe(15);
  });

  it('calculates cost for update_status as base only', () => {
    // base (10) + update_status (0) = 10
    expect(calculateAutomationCreditCost(['update_status'])).toBe(10);
  });

  it('calculates cost for multiple actions', () => {
    // base (10) + send_email (10) + send_sms (25) = 45
    expect(calculateAutomationCreditCost(['send_email', 'send_sms'])).toBe(45);
  });

  it('handles unknown action types gracefully (0 cost)', () => {
    // base (10) + unknown (0) = 10
    expect(calculateAutomationCreditCost(['nonexistent_action'])).toBe(10);
  });

  it('handles mixed known and unknown actions', () => {
    // base (10) + send_sms (25) + unknown (0) + create_task (5) = 40
    expect(
      calculateAutomationCreditCost(['send_sms', 'unknown_type', 'create_task']),
    ).toBe(40);
  });

  it('base cost equals getCreditCost for automation_run', () => {
    expect(getCreditCost('automation_run')).toBe(10);
    expect(calculateAutomationCreditCost([])).toBe(getCreditCost('automation_run'));
  });
});
