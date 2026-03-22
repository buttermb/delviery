/**
 * create-order edge function — Credit Gate Integration Tests
 *
 * Verifies the create-order function uses the correct CREDIT_ACTIONS key
 * (ORDER_CREATE_MANUAL = 'order_create_manual', 50 credits) and that the
 * CREDIT_ACTIONS constant is properly defined.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Read source files ────────────────────────────────────────────────────
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');
const CREATE_ORDER_SRC = fs.readFileSync(
  path.join(FUNCTIONS_DIR, 'create-order', 'index.ts'),
  'utf-8'
);
const CREDIT_GATE_SRC = fs.readFileSync(
  path.join(FUNCTIONS_DIR, '_shared', 'creditGate.ts'),
  'utf-8'
);

// ── Tests ────────────────────────────────────────────────────────────────

describe('create-order credit gate integration', () => {
  it('should import withCreditGate and CREDIT_ACTIONS from _shared/creditGate', () => {
    expect(CREATE_ORDER_SRC).toContain(
      "import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'"
    );
  });

  it('should use CREDIT_ACTIONS.ORDER_CREATE_MANUAL as the action key', () => {
    expect(CREATE_ORDER_SRC).toContain('CREDIT_ACTIONS.ORDER_CREATE_MANUAL');
  });

  it('should NOT use the old CREDIT_ACTIONS.CREATE_ORDER key', () => {
    // The handler line should reference ORDER_CREATE_MANUAL, not CREATE_ORDER
    const handlerLine = CREATE_ORDER_SRC
      .split('\n')
      .find((line: string) => line.includes('withCreditGate(req,'));
    expect(handlerLine).toBeDefined();
    expect(handlerLine).toContain('ORDER_CREATE_MANUAL');
    expect(handlerLine).not.toContain('CREDIT_ACTIONS.CREATE_ORDER');
  });

  it('should define ORDER_CREATE_MANUAL in CREDIT_ACTIONS constant', () => {
    expect(CREDIT_GATE_SRC).toContain("ORDER_CREATE_MANUAL: 'order_create_manual'");
  });

  it('should still define CREATE_ORDER for backward compat with other functions', () => {
    // CREATE_ORDER is used by wholesale-order-create and possibly others
    expect(CREDIT_GATE_SRC).toContain("CREATE_ORDER: 'create_order'");
  });

  it('should wrap the handler callback with withCreditGate', () => {
    // Verify the withCreditGate wraps the entire handler
    const lines = CREATE_ORDER_SRC.split('\n');
    const gateStart = lines.findIndex((l: string) =>
      l.includes('withCreditGate(req, CREDIT_ACTIONS.ORDER_CREATE_MANUAL')
    );
    const gateEnd = lines.findIndex((l: string) =>
      l.includes('End of withCreditGate')
    );

    expect(gateStart).toBeGreaterThan(-1);
    expect(gateEnd).toBeGreaterThan(gateStart);
  });

  it('should handle CORS preflight before credit gate', () => {
    const lines = CREATE_ORDER_SRC.split('\n');
    const corsLine = lines.findIndex((l: string) =>
      l.includes("req.method === 'OPTIONS'")
    );
    const gateLine = lines.findIndex((l: string) =>
      l.includes('withCreditGate(req,')
    );

    // CORS check should come before the credit gate
    expect(corsLine).toBeGreaterThan(-1);
    expect(gateLine).toBeGreaterThan(corsLine);
  });

  it('should return proper JSON error responses in catch block', () => {
    expect(CREATE_ORDER_SRC).toContain("'Content-Type': 'application/json'");
    expect(CREATE_ORDER_SRC).toContain('JSON.stringify');
  });
});
