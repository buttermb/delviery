/**
 * Leafly Suggestions Credit Gate Tests
 *
 * Verifies that the leafly-suggestions edge function is properly gated by credits:
 * 1. ai_suggestions action key costs 100 credits
 * 2. ai_suggestions is categorized under 'ai'
 * 3. ai_suggestions is not a free action
 * 4. Edge function source uses withCreditGate with CREDIT_ACTIONS.AI_SUGGESTIONS
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  getCreditCost,
  getCreditCostInfo,
  isActionFree,
} from '../creditCosts';

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Leafly Suggestions Credit Configuration', () => {
  it('ai_suggestions should cost 100 credits', () => {
    expect(getCreditCost('ai_suggestions')).toBe(100);
  });

  it('ai_suggestions should be categorized under ai', () => {
    const info = getCreditCostInfo('ai_suggestions');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('ai');
    expect(info?.actionName).toBe('AI Suggestions');
    expect(info?.credits).toBe(100);
  });

  it('ai_suggestions should not be a free action', () => {
    expect(isActionFree('ai_suggestions')).toBe(false);
  });
});

// ============================================================================
// Edge Function Integration Tests
// ============================================================================

describe('Leafly Suggestions Edge Function Credit Gate Integration', () => {
  const edgeFunctionPath = resolve(
    __dirname,
    '../../../../supabase/functions/leafly-suggestions/index.ts'
  );

  let source: string;

  try {
    source = readFileSync(edgeFunctionPath, 'utf-8');
  } catch {
    source = '';
  }

  it('should import withCreditGate from shared module', () => {
    expect(source).toContain("import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
  });

  it('should wrap handler with withCreditGate using AI_SUGGESTIONS action', () => {
    expect(source).toContain('CREDIT_ACTIONS.AI_SUGGESTIONS');
    expect(source).toContain('withCreditGate(req, CREDIT_ACTIONS.AI_SUGGESTIONS');
  });

  it('should handle CORS preflight before credit gate', () => {
    const corsIndex = source.indexOf('req.method === "OPTIONS"');
    const creditGateIndex = source.indexOf('withCreditGate(req');
    expect(corsIndex).toBeGreaterThan(-1);
    expect(creditGateIndex).toBeGreaterThan(-1);
    expect(corsIndex).toBeLessThan(creditGateIndex);
  });
});
