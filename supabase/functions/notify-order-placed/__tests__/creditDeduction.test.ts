/**
 * Credit Deduction Tests for notify-order-placed
 *
 * Verifies:
 * 1. Credit gating via consume_credits RPC with action_key 'send_email'
 * 2. Proper 402 response on insufficient credits
 * 3. Credit headers on success response
 * 4. Auth and tenant resolution before credit check
 * 5. Null safety for order data
 * 6. Removed broken account_logs insert
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const indexPath = path.resolve(__dirname, '../index.ts');
const sourceCode = fs.readFileSync(indexPath, 'utf-8');

describe('notify-order-placed', () => {
  describe('shared deps', () => {
    it('imports serve from shared deps', () => {
      expect(sourceCode).toContain("import { serve, createClient, corsHeaders } from '../_shared/deps.ts'");
    });

    it('does not define its own corsHeaders', () => {
      expect(sourceCode).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('auth and tenant resolution', () => {
    it('checks for Bearer token in Authorization header', () => {
      expect(sourceCode).toContain("authHeader?.startsWith('Bearer ')");
    });

    it('returns 401 when no auth header', () => {
      expect(sourceCode).toContain("JSON.stringify({ error: 'Unauthorized' })");
      expect(sourceCode).toContain('status: 401');
    });

    it('resolves tenant from tenant_users table', () => {
      expect(sourceCode).toContain("from('tenant_users')");
      expect(sourceCode).toContain("eq('user_id', user.id)");
    });

    it('uses maybeSingle for tenant lookup', () => {
      expect(sourceCode).toContain('.maybeSingle()');
    });

    it('returns 403 when no tenant associated', () => {
      expect(sourceCode).toContain("error: 'No tenant associated with user'");
      expect(sourceCode).toContain('status: 403');
    });
  });

  describe('input validation', () => {
    it('handles invalid JSON body gracefully', () => {
      expect(sourceCode).toContain("error: 'Invalid JSON body'");
      expect(sourceCode).toContain('status: 400');
    });

    it('validates orderId is required', () => {
      expect(sourceCode).toContain("error: 'Order ID is required'");
    });

    it('returns 400 for missing orderId instead of throwing', () => {
      // Ensure orderId validation returns a Response, not throws
      const validationBlock = sourceCode.substring(
        sourceCode.indexOf("const orderId = body.orderId"),
        sourceCode.indexOf('// Credit deduction')
      );
      expect(validationBlock).toContain('status: 400');
      expect(validationBlock).not.toContain('throw');
    });
  });

  describe('credit deduction', () => {
    it('calls consume_credits RPC with correct parameters', () => {
      expect(sourceCode).toContain("supabaseClient.rpc(\n      'consume_credits'");
      expect(sourceCode).toContain('p_tenant_id: tenantId');
      expect(sourceCode).toContain("p_action_key: 'send_email'");
      expect(sourceCode).toContain('p_reference_id: orderId');
      expect(sourceCode).toContain("p_reference_type: 'order_notification'");
    });

    it('includes order ID in credit description', () => {
      expect(sourceCode).toContain('`Order placed notification for order ${orderId}`');
    });

    it('returns 402 on insufficient credits', () => {
      expect(sourceCode).toContain('status: 402');
      expect(sourceCode).toContain("error: 'Insufficient credits'");
      expect(sourceCode).toContain("code: 'INSUFFICIENT_CREDITS'");
    });

    it('includes creditsRequired and currentBalance in 402 response', () => {
      expect(sourceCode).toContain('creditsRequired: result.credits_cost');
      expect(sourceCode).toContain('currentBalance: result.new_balance');
    });

    it('tracks credit state with creditDeducted flag', () => {
      expect(sourceCode).toContain('let creditDeducted = false');
      expect(sourceCode).toContain('creditDeducted = true');
    });

    it('logs credit errors without blocking', () => {
      expect(sourceCode).toContain("console.error('Credit deduction error:', creditError.message)");
    });

    it('deducts credits before querying order details', () => {
      const creditIdx = sourceCode.indexOf("supabaseClient.rpc(\n      'consume_credits'");
      const orderQueryIdx = sourceCode.indexOf("from('menu_orders')");
      expect(creditIdx).toBeGreaterThan(-1);
      expect(orderQueryIdx).toBeGreaterThan(-1);
      expect(creditIdx).toBeLessThan(orderQueryIdx);
    });
  });

  describe('credit response headers', () => {
    it('sets X-Credits-Consumed header when credits were deducted', () => {
      expect(sourceCode).toContain("responseHeaders['X-Credits-Consumed'] = String(creditsCost)");
    });

    it('sets X-Credits-Remaining header when credits were deducted', () => {
      expect(sourceCode).toContain("responseHeaders['X-Credits-Remaining'] = String(creditsRemaining)");
    });

    it('only adds credit headers when creditDeducted is true', () => {
      expect(sourceCode).toContain('if (creditDeducted)');
    });
  });

  describe('order query', () => {
    it('queries menu_orders with tenant_id filter', () => {
      expect(sourceCode).toContain("from('menu_orders')");
      expect(sourceCode).toContain("eq('disposable_menus.tenant_id', tenantId)");
    });

    it('joins disposable_menus with inner join', () => {
      expect(sourceCode).toContain('disposable_menus!inner');
    });

    it('uses maybeSingle for order lookup', () => {
      const orderSection = sourceCode.substring(
        sourceCode.indexOf("from('menu_orders')"),
        sourceCode.indexOf('if (orderError)')
      );
      expect(orderSection).toContain('.maybeSingle()');
    });

    it('returns 404 when order not found', () => {
      expect(sourceCode).toContain("error: 'Order not found or access denied'");
      expect(sourceCode).toContain('status: 404');
    });
  });

  describe('null safety', () => {
    it('handles null total_amount with Number() fallback', () => {
      expect(sourceCode).toContain('Number(order.total_amount) || 0');
    });

    it('handles null order_data with fallback', () => {
      expect(sourceCode).toContain('(order.order_data ?? {})');
    });

    it('validates items is an array before mapping', () => {
      expect(sourceCode).toContain('Array.isArray(orderData?.items)');
    });

    it('handles null total_price in items', () => {
      expect(sourceCode).toContain('Number(item.total_price || 0)');
    });

    it('handles null contact_phone', () => {
      expect(sourceCode).toContain("order.contact_phone || 'N/A'");
    });
  });

  describe('no broken account_logs insert', () => {
    it('does not insert into account_logs with wrong columns', () => {
      // The old code used non-existent columns (menu_id, action, details)
      // which caused 500 errors
      expect(sourceCode).not.toContain("from('account_logs')");
    });
  });

  describe('security event logging', () => {
    it('creates menu_security_events entry for new order', () => {
      expect(sourceCode).toContain("from('menu_security_events')");
      expect(sourceCode).toContain("event_type: 'new_order'");
      expect(sourceCode).toContain("severity: 'medium'");
    });

    it('includes order metadata in security event', () => {
      expect(sourceCode).toContain('order_id: orderId');
      expect(sourceCode).toContain('total_amount: totalAmount');
      expect(sourceCode).toContain('item_count: items.length');
    });
  });

  describe('success response', () => {
    it('returns success with notification previews', () => {
      expect(sourceCode).toContain('success: true');
      expect(sourceCode).toContain("message: 'Order notifications sent'");
    });

    it('includes both customer and admin previews', () => {
      expect(sourceCode).toContain('customer: customerMessage');
      expect(sourceCode).toContain('admin: adminMessage');
    });
  });

  describe('error handling', () => {
    it('catches all errors and returns proper JSON response', () => {
      expect(sourceCode).toContain('} catch (error: unknown)');
      expect(sourceCode).toContain("error instanceof Error ? error.message : 'Unknown error'");
    });

    it('returns 400 for caught errors, not 500', () => {
      // The catch block should return 400, not 500
      const catchBlock = sourceCode.substring(sourceCode.lastIndexOf('} catch (error: unknown)'));
      expect(catchBlock).toContain('status: 400');
    });
  });

  describe('CORS handling', () => {
    it('handles OPTIONS preflight requests', () => {
      expect(sourceCode).toContain("req.method === 'OPTIONS'");
    });
  });
});
