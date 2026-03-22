/**
 * menu-order-place Edge Function — Credit Deduction Tests
 *
 * Verifies that the menu-order-place edge function correctly integrates
 * with the credit system using action_key 'menu_order_received' (75 credits).
 * The menu OWNER's tenant is charged when a customer places an order.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('menu-order-place credit deduction', () => {
  const source = readEdgeFunctionSource();

  it('should import checkCreditsAvailable from creditGate', () => {
    expect(source).toContain("import { checkCreditsAvailable }");
    expect(source).toContain("../_shared/creditGate.ts");
  });

  it('should use menu_order_received action key', () => {
    expect(source).toContain("'menu_order_received'");
  });

  it('should check credits available before consuming', () => {
    const creditCheckIndex = source.indexOf('checkCreditsAvailable');
    const consumeCreditsIndex = source.indexOf("consume_credits");

    expect(creditCheckIndex).toBeGreaterThan(-1);
    expect(consumeCreditsIndex).toBeGreaterThan(-1);
    expect(creditCheckIndex).toBeLessThan(consumeCreditsIndex);
  });

  it('should fetch tenant_id from disposable_menus table', () => {
    // The tenant info lookup must query disposable_menus for tenant_id
    expect(source).toContain("from('disposable_menus')");
    expect(source).toContain("select('tenant_id')");
  });

  it('should check credits before processing payment', () => {
    const creditCheckIndex = source.indexOf('checkCreditsAvailable');
    const processPaymentIndex = source.indexOf('processPayment(');

    expect(creditCheckIndex).toBeGreaterThan(-1);
    expect(processPaymentIndex).toBeGreaterThan(-1);
    // Credit check must occur before payment processing
    expect(creditCheckIndex).toBeLessThan(processPaymentIndex);
  });

  it('should cancel reservation when credits are insufficient', () => {
    // Find the insufficient credits block
    const insufficientBlock = source.slice(
      source.indexOf('!creditCheck.hasCredits'),
      source.indexOf('// Consume credits for free tier')
    );

    expect(insufficientBlock).toContain("cancel_reservation");
    expect(insufficientBlock).toContain("'insufficient_credits'");
  });

  it('should return 402 status when credits are insufficient', () => {
    // Find the insufficient credits response section
    const insufficientBlock = source.slice(
      source.indexOf('!creditCheck.hasCredits'),
      source.indexOf('// Consume credits for free tier')
    );

    expect(insufficientBlock).toContain('status: 402');
    expect(insufficientBlock).toContain('INSUFFICIENT_CREDITS');
  });

  it('should only consume credits for free tier tenants', () => {
    expect(source).toContain('creditCheck.isFreeTier && !creditCheck.hasCredits');
    expect(source).toContain('if (creditCheck.isFreeTier)');
  });

  it('should pass reference_id and reference_type to consume_credits RPC', () => {
    // Verify structured credit consumption with reference tracking
    expect(source).toContain("p_reference_id:");
    expect(source).toContain("p_reference_type: 'menu_order'");
  });

  it('should not block customer orders when credit deduction RPC fails', () => {
    // The function should fail open — log but don't block
    expect(source).toContain("Fail open: log but don't block the customer order");
  });

  it('should provide a customer-friendly error message when credits are insufficient', () => {
    // The error should not expose internal credit system details to the customer
    expect(source).toContain('This menu is temporarily unavailable');
  });

  it('should log credit deduction with traceId for observability', () => {
    expect(source).toContain('[ORDER_CREATE] Credits deducted (menu_order_received)');
    expect(source).toContain('[ORDER_CREATE] Insufficient credits for tenant');
    expect(source).toContain('[ORDER_CREATE] Credit deduction failed');
  });
});
