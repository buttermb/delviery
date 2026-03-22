/**
 * Commission Calculate Edge Function — Source Analysis Tests
 *
 * Verifies that the commission-calculate edge function:
 * 1. Uses withCreditGate with the correct action key
 * 2. Filters by tenant_id (via tenant menus)
 * 3. Avoids duplicate commission records
 * 4. Uses proper CORS handling
 * 5. Returns expected response shape
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(
    __dirname,
    '..',
    'index.ts',
  );
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

describe('Commission Calculate Edge Function', () => {
  const source = readEdgeFunctionSource();

  describe('credit gating', () => {
    it('should import withCreditGate from shared module', () => {
      expect(source).toContain("import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should wrap handler with withCreditGate using COMMISSION_CALCULATE action', () => {
      expect(source).toContain('CREDIT_ACTIONS.COMMISSION_CALCULATE');
    });

    it('should use commission_calculate action key constant', () => {
      expect(source).toContain('withCreditGate(req, CREDIT_ACTIONS.COMMISSION_CALCULATE');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
      expect(source).toContain('corsHeaders');
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("import { createClient, corsHeaders } from '../_shared/deps.ts'");
    });
  });

  describe('tenant isolation', () => {
    it('should filter orders by tenant menus', () => {
      expect(source).toContain("'disposable_menus'");
      expect(source).toContain("eq('tenant_id', tenantId)");
    });

    it('should filter commission_transactions by tenant_id', () => {
      expect(source).toContain("from('commission_transactions')");
      expect(source).toContain("eq('tenant_id', tenantId)");
    });
  });

  describe('duplicate prevention', () => {
    it('should check for existing commission records before inserting', () => {
      expect(source).toContain('existingCommissions');
      expect(source).toContain('existingOrderIds');
    });

    it('should filter out orders that already have commissions', () => {
      expect(source).toContain('existingOrderIds.has(order.id)');
    });
  });

  describe('commission calculation', () => {
    it('should use 2% commission rate', () => {
      expect(source).toContain('COMMISSION_RATE = 0.02');
    });

    it('should only process confirmed orders', () => {
      expect(source).toContain("eq('status', 'confirmed')");
    });

    it('should filter out orders with zero amount', () => {
      expect(source).toContain('order.total_amount > 0');
    });
  });

  describe('response shape', () => {
    it('should return success, calculated count, skipped count, and total_commission', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('calculated:');
      expect(source).toContain('skipped:');
      expect(source).toContain('total_commission:');
    });

    it('should return JSON content type', () => {
      expect(source).toContain("'Content-Type': 'application/json'");
    });
  });

  describe('error handling', () => {
    it('should catch and return errors with 400 status', () => {
      expect(source).toContain('status: 400');
    });

    it('should log errors to console', () => {
      expect(source).toContain("console.error('Commission calculation failed:'");
    });
  });

  describe('optional filtering', () => {
    it('should support filtering by order_ids', () => {
      expect(source).toContain('order_ids');
      expect(source).toContain("in('id', order_ids)");
    });

    it('should support filtering by date range', () => {
      expect(source).toContain('date_from');
      expect(source).toContain('date_to');
      expect(source).toContain("gte('created_at', date_from)");
      expect(source).toContain("lte('created_at', date_to)");
    });
  });
});
