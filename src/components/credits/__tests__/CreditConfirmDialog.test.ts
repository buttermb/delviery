/**
 * CreditConfirmDialog Tests
 *
 * Tests the threshold logic for showing the confirmation dialog.
 * Tests import only from creditCosts.ts to avoid Supabase client side effects.
 */

import { describe, it, expect } from 'vitest';
import {
  HIGH_COST_THRESHOLD,
  getCreditCost,
  getCreditCostInfo,
  CREDIT_COSTS,
} from '@/lib/credits/creditCosts';

describe('CreditConfirmDialog threshold logic', () => {
  describe('HIGH_COST_THRESHOLD is 50 credits', () => {
    it('should be 50', () => {
      expect(HIGH_COST_THRESHOLD).toBe(50);
    });
  });

  describe('Actions at exactly the threshold', () => {
    const actionsAtThreshold = Object.values(CREDIT_COSTS).filter(
      (c) => c.credits === HIGH_COST_THRESHOLD
    );

    it('should have actions at exactly 50 credits', () => {
      expect(actionsAtThreshold.length).toBeGreaterThan(0);
    });

    it('order_create_manual costs exactly 50', () => {
      expect(getCreditCost('order_create_manual')).toBe(50);
    });

    it('invoice_create costs exactly 50', () => {
      expect(getCreditCost('invoice_create')).toBe(50);
    });
  });

  describe('Actions above the threshold should require confirmation', () => {
    const casesAbove: Array<[string, number]> = [
      ['menu_create', 100],
      ['wholesale_order_place', 100],
      ['menu_order_received', 75],
      ['storefront_create', 500],
      ['menu_ocr', 250],
      ['ai_suggestions', 100],
      ['report_custom_generate', 75],
      ['data_warehouse_export', 200],
      ['compliance_report_generate', 100],
      ['marketplace_order_created', 100],
      ['marketplace_bulk_update', 100],
    ];

    it.each(casesAbove)(
      '%s (cost=%d) should be >= HIGH_COST_THRESHOLD',
      (actionKey, expectedCost) => {
        const cost = getCreditCost(actionKey);
        expect(cost).toBe(expectedCost);
        expect(cost).toBeGreaterThanOrEqual(HIGH_COST_THRESHOLD);
      }
    );
  });

  describe('Actions below the threshold should NOT require confirmation', () => {
    const casesBelow: Array<[string, number]> = [
      ['product_add', 10],
      ['pos_process_sale', 25],
      ['send_sms', 25],
      ['loyalty_reward_create', 25],
      ['stock_update', 3],
      ['delivery_create', 30],
    ];

    it.each(casesBelow)(
      '%s (cost=%d) should be < HIGH_COST_THRESHOLD',
      (actionKey, expectedCost) => {
        const cost = getCreditCost(actionKey);
        expect(cost).toBe(expectedCost);
        expect(cost).toBeLessThan(HIGH_COST_THRESHOLD);
      }
    );
  });

  describe('Free actions never require confirmation', () => {
    it('dashboard_view costs 0', () => {
      expect(getCreditCost('dashboard_view')).toBe(0);
    });

    it('settings_view costs 0', () => {
      expect(getCreditCost('settings_view')).toBe(0);
    });

    it('unknown actions default to 0', () => {
      expect(getCreditCost('nonexistent_action')).toBe(0);
    });
  });

  describe('getCreditCostInfo returns full info for high-cost actions', () => {
    it('returns info for storefront_create', () => {
      const info = getCreditCostInfo('storefront_create');
      expect(info).not.toBeNull();
      expect(info?.credits).toBe(500);
      expect(info?.actionName).toBe('Create Storefront');
    });

    it('returns null for unknown actions', () => {
      const info = getCreditCostInfo('nonexistent_action');
      expect(info).toBeNull();
    });
  });
});
