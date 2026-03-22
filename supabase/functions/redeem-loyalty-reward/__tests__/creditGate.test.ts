/**
 * Redeem Loyalty Reward — Credit Gate Integration Tests
 *
 * Verifies that the redeem-loyalty-reward edge function correctly integrates
 * with the credit gate middleware using action_key 'loyalty_reward_issue'
 * (15 credits).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getCreditCost, getCreditCostInfo } from '@/lib/credits/creditCosts';

// ── Helpers ────────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(
    __dirname,
    '..',
    'index.ts',
  );
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Redeem Loyalty Reward — Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  describe('withCreditGate integration', () => {
    it('should import withCreditGate from shared creditGate module', () => {
      expect(source).toContain("import { withCreditGate } from '../_shared/creditGate.ts'");
    });

    it('should wrap handler with withCreditGate middleware', () => {
      expect(source).toMatch(/withCreditGate\s*\(\s*req\s*,/);
    });

    it('should use loyalty_reward_issue action key', () => {
      expect(source).toContain("'loyalty_reward_issue'");
    });

    it('should pass loyalty_reward as reference type', () => {
      expect(source).toContain("referenceType: 'loyalty_reward'");
    });

    it('should use shared deps for imports instead of direct esm.sh', () => {
      expect(source).toContain("from '../_shared/deps.ts'");
      expect(source).not.toContain("from 'https://esm.sh/@supabase/supabase-js@2'");
    });

    it('should use shared corsHeaders instead of local definition', () => {
      // Should import corsHeaders from deps, not define locally
      expect(source).toMatch(/import\s*\{[^}]*corsHeaders[^}]*\}\s*from\s*'\.\.\/\_shared\/deps\.ts'/);
    });

    it('should handle CORS preflight before credit gate call', () => {
      const optionsIndex = source.indexOf("req.method === 'OPTIONS'");
      // Find the withCreditGate invocation (not the import)
      const creditGateCallIndex = source.indexOf('withCreditGate(req');
      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditGateCallIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditGateCallIndex);
    });
  });

  describe('tenant isolation via credit gate', () => {
    it('should use tenantId from withCreditGate callback for queries', () => {
      // The handler should receive tenantId from withCreditGate
      expect(source).toMatch(/withCreditGate\(req,\s*'loyalty_reward_issue',\s*async\s*\(tenantId/);
    });

    it('should filter loyalty_rewards by tenantId', () => {
      expect(source).toContain(".eq('tenant_id', tenantId)");
    });

    it('should not perform redundant auth lookups', () => {
      // withCreditGate handles auth, so no manual getUser or tenant_users lookup
      expect(source).not.toContain('.auth.getUser()');
      expect(source).not.toContain("from('tenant_users')");
    });
  });

  describe('loyalty_reward_issue credit cost', () => {
    it('should cost exactly 15 credits', () => {
      const cost = getCreditCost('loyalty_reward_issue');
      expect(cost).toBe(15);
    });

    it('should have correct credit cost info', () => {
      const info = getCreditCostInfo('loyalty_reward_issue');
      expect(info).not.toBeNull();
      expect(info?.actionKey).toBe('loyalty_reward_issue');
      expect(info?.credits).toBe(15);
      expect(info?.category).toBe('loyalty');
    });

    it('should have a descriptive action name', () => {
      const info = getCreditCostInfo('loyalty_reward_issue');
      expect(info?.actionName).toBeTruthy();
      expect(info?.actionName?.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should return proper error responses with corsHeaders', () => {
      // All error responses should include corsHeaders
      const errorResponses = source.match(/new Response\(\s*JSON\.stringify\(\{.*?error/gs) || [];
      expect(errorResponses.length).toBeGreaterThan(0);

      // Should use corsHeaders from shared deps
      expect(source).toContain('...corsHeaders');
    });

    it('should return 400 for insufficient points instead of throwing', () => {
      // Verify we return a proper response for insufficient points
      expect(source).toContain("'Insufficient points'");
      expect(source).toContain('status: 400');
    });
  });

  describe('handler structure', () => {
    it('should validate input with validateRedeemLoyaltyReward', () => {
      expect(source).toContain('validateRedeemLoyaltyReward');
    });

    it('should generate a redemption code on success', () => {
      expect(source).toContain('redemptionCode');
      // Template literal uses backticks: `RWD-${...}`
      expect(source).toContain('RWD-');
    });

    it('should return success response with reward details', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('pointsDeducted');
      expect(source).toContain('remainingBalance');
    });
  });
});
