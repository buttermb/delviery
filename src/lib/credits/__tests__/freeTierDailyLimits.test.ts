/**
 * Free Tier Daily Limit Enforcement Tests
 *
 * Verifies that:
 * 1. ACTION_KEY_TO_FREE_TIER_MAP correctly maps action keys to free tier categories
 * 2. getFreeTierLimit returns correct limits for each category
 * 3. The mapping is consistent with FREE_TIER_LIMITS constants
 * 4. The SQL consume_credits function limits match frontend constants
 *
 * The actual DB enforcement is tested via integration tests. These unit tests
 * verify the frontend mapping and constants are self-consistent.
 */

import { describe, it, expect } from 'vitest';
import {
  FREE_TIER_LIMITS,
  ACTION_KEY_TO_FREE_TIER_MAP,
  getFreeTierLimit,
  type FreeTierActionType,
} from '../creditCosts';

// ============================================================================
// ACTION_KEY_TO_FREE_TIER_MAP Tests
// ============================================================================

describe('ACTION_KEY_TO_FREE_TIER_MAP', () => {
  it('should map menu action keys to menu_create', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['menu_create']).toBe('menu_create');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['menu_generate']).toBe('menu_create');
  });

  it('should map order action keys to order_create', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['order_create_manual']).toBe('order_create');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['menu_order_received']).toBe('order_create');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['order_create']).toBe('order_create');
  });

  it('should map SMS action keys to sms_send', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_sms']).toBe('sms_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_otp']).toBe('sms_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_verification_sms']).toBe('sms_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_klaviyo_sms']).toBe('sms_send');
  });

  it('should map email action keys to email_send', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_email']).toBe('email_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_welcome_email']).toBe('email_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_invitation_email']).toBe('email_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_verification_email']).toBe('email_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_klaviyo_email']).toBe('email_send');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['send_trial_reminder']).toBe('email_send');
  });

  it('should map POS action keys to pos_sale', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['pos_process_sale']).toBe('pos_sale');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['pos_checkout']).toBe('pos_sale');
  });

  it('should map bulk operation action keys to bulk_operation', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['product_bulk_import']).toBe('bulk_operation');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['stock_bulk_update']).toBe('bulk_operation');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['customer_import']).toBe('bulk_operation');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['marketplace_bulk_update']).toBe('bulk_operation');
  });

  it('should map invoice action keys to invoice_create', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['invoice_create']).toBe('invoice_create');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['invoice_send']).toBe('invoice_create');
  });

  it('should map report action keys to custom_report', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['report_custom_generate']).toBe('custom_report');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['report_advanced_generate']).toBe('custom_report');
  });

  it('should map AI action keys to ai_feature', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['ai_suggestions']).toBe('ai_feature');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['ai_insight_generate']).toBe('ai_feature');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['ai_task_run']).toBe('ai_feature');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['forecast_run']).toBe('ai_feature');
    expect(ACTION_KEY_TO_FREE_TIER_MAP['menu_ocr']).toBe('ai_feature');
  });

  it('should not have entries for non-limited actions', () => {
    expect(ACTION_KEY_TO_FREE_TIER_MAP['dashboard_view']).toBeUndefined();
    expect(ACTION_KEY_TO_FREE_TIER_MAP['orders_view']).toBeUndefined();
    expect(ACTION_KEY_TO_FREE_TIER_MAP['product_view']).toBeUndefined();
    expect(ACTION_KEY_TO_FREE_TIER_MAP['settings_view']).toBeUndefined();
  });

  it('should only contain valid FreeTierActionType values', () => {
    const validTypes: FreeTierActionType[] = [
      'menu_create', 'order_create', 'sms_send', 'email_send',
      'pos_sale', 'bulk_operation', 'invoice_create', 'custom_report', 'ai_feature',
    ];

    for (const [actionKey, freeTierAction] of Object.entries(ACTION_KEY_TO_FREE_TIER_MAP)) {
      expect(validTypes).toContain(freeTierAction);
    }
  });
});

// ============================================================================
// getFreeTierLimit Tests
// ============================================================================

describe('getFreeTierLimit', () => {
  it('should return correct daily limit for menu creation', () => {
    const result = getFreeTierLimit('menu_create');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_menus_per_day, period: 'day' });
    expect(result?.limit).toBe(1);
  });

  it('should return correct daily limit for orders', () => {
    const result = getFreeTierLimit('order_create_manual');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_orders_per_day, period: 'day' });
    expect(result?.limit).toBe(3);
  });

  it('should return correct daily limit for SMS', () => {
    const result = getFreeTierLimit('send_sms');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_sms_per_day, period: 'day' });
    expect(result?.limit).toBe(2);
  });

  it('should return correct daily limit for emails', () => {
    const result = getFreeTierLimit('send_email');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_emails_per_day, period: 'day' });
    expect(result?.limit).toBe(5);
  });

  it('should return correct daily limit for POS sales', () => {
    const result = getFreeTierLimit('pos_process_sale');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_pos_sales_per_day, period: 'day' });
    expect(result?.limit).toBe(5);
  });

  it('should return correct daily limit for bulk operations', () => {
    const result = getFreeTierLimit('product_bulk_import');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_bulk_operations_per_day, period: 'day' });
    expect(result?.limit).toBe(1);
  });

  it('should return correct monthly limit for invoices', () => {
    const result = getFreeTierLimit('invoice_create');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_invoices_per_month, period: 'month' });
    expect(result?.limit).toBe(3);
  });

  it('should return 0 limit (blocked) for custom reports on free tier', () => {
    const result = getFreeTierLimit('report_custom_generate');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_custom_reports_per_month, period: 'month' });
    expect(result?.limit).toBe(0);
  });

  it('should return 0 limit (blocked) for AI features on free tier', () => {
    const result = getFreeTierLimit('ai_suggestions');
    expect(result).toEqual({ limit: FREE_TIER_LIMITS.max_ai_features_per_month, period: 'month' });
    expect(result?.limit).toBe(0);
  });

  it('should return null for non-limited actions', () => {
    expect(getFreeTierLimit('dashboard_view')).toBeNull();
    expect(getFreeTierLimit('orders_view')).toBeNull();
    expect(getFreeTierLimit('product_view')).toBeNull();
    expect(getFreeTierLimit('unknown_action')).toBeNull();
    expect(getFreeTierLimit('')).toBeNull();
  });

  it('should return correct limits for aliased action keys', () => {
    // menu_generate maps to same limit as menu_create
    expect(getFreeTierLimit('menu_generate')).toEqual(getFreeTierLimit('menu_create'));
    // send_otp maps to same limit as send_sms
    expect(getFreeTierLimit('send_otp')).toEqual(getFreeTierLimit('send_sms'));
    // send_welcome_email maps to same limit as send_email
    expect(getFreeTierLimit('send_welcome_email')).toEqual(getFreeTierLimit('send_email'));
  });
});

// ============================================================================
// SQL / Frontend Consistency Tests
// ============================================================================

describe('SQL and Frontend Consistency', () => {
  /**
   * These are the exact limits that the consume_credits SQL function enforces.
   * If these change in the SQL migration, these tests MUST be updated too.
   */
  const SQL_ENFORCED_LIMITS: Record<FreeTierActionType, number> = {
    menu_create: 1,
    order_create: 3,
    sms_send: 2,
    email_send: 5,
    pos_sale: 5,
    bulk_operation: 1,
    invoice_create: 3,
    custom_report: 0,
    ai_feature: 0,
  };

  it('should have SQL limits matching FREE_TIER_LIMITS constants', () => {
    expect(SQL_ENFORCED_LIMITS.menu_create).toBe(FREE_TIER_LIMITS.max_menus_per_day);
    expect(SQL_ENFORCED_LIMITS.order_create).toBe(FREE_TIER_LIMITS.max_orders_per_day);
    expect(SQL_ENFORCED_LIMITS.sms_send).toBe(FREE_TIER_LIMITS.max_sms_per_day);
    expect(SQL_ENFORCED_LIMITS.email_send).toBe(FREE_TIER_LIMITS.max_emails_per_day);
    expect(SQL_ENFORCED_LIMITS.pos_sale).toBe(FREE_TIER_LIMITS.max_pos_sales_per_day);
    expect(SQL_ENFORCED_LIMITS.bulk_operation).toBe(FREE_TIER_LIMITS.max_bulk_operations_per_day);
    expect(SQL_ENFORCED_LIMITS.invoice_create).toBe(FREE_TIER_LIMITS.max_invoices_per_month);
    expect(SQL_ENFORCED_LIMITS.custom_report).toBe(FREE_TIER_LIMITS.max_custom_reports_per_month);
    expect(SQL_ENFORCED_LIMITS.ai_feature).toBe(FREE_TIER_LIMITS.max_ai_features_per_month);
  });

  it('should have getFreeTierLimit returning limits matching SQL enforcement', () => {
    for (const [actionType, sqlLimit] of Object.entries(SQL_ENFORCED_LIMITS)) {
      // Find an action key that maps to this action type
      const actionKey = Object.entries(ACTION_KEY_TO_FREE_TIER_MAP)
        .find(([, type]) => type === actionType)?.[0];

      expect(actionKey).toBeDefined();
      const result = getFreeTierLimit(actionKey!);
      expect(result).not.toBeNull();
      expect(result!.limit).toBe(sqlLimit);
    }
  });

  it('should cover all 9 free tier action types', () => {
    const allTypes = new Set(Object.values(ACTION_KEY_TO_FREE_TIER_MAP));
    expect(allTypes.size).toBe(9);
    expect(allTypes).toContain('menu_create');
    expect(allTypes).toContain('order_create');
    expect(allTypes).toContain('sms_send');
    expect(allTypes).toContain('email_send');
    expect(allTypes).toContain('pos_sale');
    expect(allTypes).toContain('bulk_operation');
    expect(allTypes).toContain('invoice_create');
    expect(allTypes).toContain('custom_report');
    expect(allTypes).toContain('ai_feature');
  });
});
