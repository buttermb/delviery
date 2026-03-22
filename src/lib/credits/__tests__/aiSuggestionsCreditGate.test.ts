/**
 * AI Suggestions Credit Gate Tests
 *
 * Verifies that ai_suggestions action is correctly configured
 * with 100 credits in the credit costs matrix, and the edge
 * function is properly structured with withCreditGate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  getCreditCost,
  getCreditCostInfo,
  isActionFree,
  CREDIT_COSTS,
} from '../creditCosts';

describe('ai_suggestions credit gate configuration', () => {
  it('should have ai_suggestions in CREDIT_COSTS', () => {
    expect(CREDIT_COSTS.ai_suggestions).toBeDefined();
  });

  it('should cost exactly 100 credits', () => {
    expect(getCreditCost('ai_suggestions')).toBe(100);
  });

  it('should return correct info via getCreditCostInfo', () => {
    const info = getCreditCostInfo('ai_suggestions');
    expect(info).not.toBeNull();
    expect(info?.actionKey).toBe('ai_suggestions');
    expect(info?.actionName).toBe('AI Suggestions');
    expect(info?.credits).toBe(100);
    expect(info?.category).toBe('ai');
  });

  it('should NOT be a free action', () => {
    expect(isActionFree('ai_suggestions')).toBe(false);
  });

  it('should be categorized as AI', () => {
    expect(CREDIT_COSTS.ai_suggestions.category).toBe('ai');
  });
});

describe('ai-suggestions edge function structure', () => {
  const edgeFunctionPath = resolve(
    __dirname,
    '../../../../supabase/functions/ai-suggestions/index.ts'
  );

  let source: string;

  try {
    source = readFileSync(edgeFunctionPath, 'utf-8');
  } catch {
    source = '';
  }

  it('should exist as a file', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('should import withCreditGate from shared creditGate', () => {
    expect(source).toContain("import");
    expect(source).toContain("withCreditGate");
    expect(source).toContain("creditGate");
  });

  it('should import CREDIT_ACTIONS', () => {
    expect(source).toContain("CREDIT_ACTIONS");
  });

  it('should use CREDIT_ACTIONS.AI_SUGGESTIONS as the action key', () => {
    expect(source).toContain("CREDIT_ACTIONS.AI_SUGGESTIONS");
  });

  it('should call withCreditGate wrapping the handler', () => {
    expect(source).toMatch(/withCreditGate\s*\(\s*req/);
  });

  it('should use Deno.serve', () => {
    expect(source).toContain("Deno.serve");
  });

  it('should handle CORS preflight', () => {
    expect(source).toContain("OPTIONS");
    expect(source).toContain("corsHeaders");
  });

  it('should validate request body with Zod', () => {
    expect(source).toContain("z.object");
    expect(source).toContain("safeParse");
  });

  it('should return suggestions in response', () => {
    expect(source).toContain("suggestions");
    expect(source).toContain("JSON.stringify");
  });
});
