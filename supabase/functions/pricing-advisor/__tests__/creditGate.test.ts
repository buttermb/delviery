/**
 * Pricing Advisor Edge Function — Credit Gate Integration Tests
 *
 * Verifies that the pricing-advisor edge function is properly wrapped
 * with withCreditGate using the 'ai_insight_generate' action key.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

describe('Pricing Advisor Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  it('should import withCreditGate from shared creditGate module', () => {
    expect(source).toContain("import { withCreditGate } from '../_shared/creditGate.ts'");
  });

  it('should import corsHeaders from shared deps', () => {
    expect(source).toContain("import { corsHeaders } from '../_shared/deps.ts'");
  });

  it('should wrap handler with withCreditGate using ai_insight_generate action key', () => {
    expect(source).toContain("withCreditGate(req, 'ai_insight_generate'");
  });

  it('should use Deno.serve instead of legacy serve import', () => {
    expect(source).toContain('Deno.serve(');
    // Should NOT have the old serve import pattern
    expect(source).not.toMatch(/import\s*{\s*serve\s*}/);
  });

  it('should handle CORS preflight before credit gate', () => {
    const corsIndex = source.indexOf("req.method === 'OPTIONS'");
    const creditGateIndex = source.indexOf('withCreditGate(');
    expect(corsIndex).toBeGreaterThan(-1);
    expect(creditGateIndex).toBeGreaterThan(-1);
    expect(corsIndex).toBeLessThan(creditGateIndex);
  });

  it('should not have duplicate CORS headers definition', () => {
    // Should not define its own corsHeaders object
    expect(source).not.toMatch(/const\s+corsHeaders\s*=/);
  });

  it('should return JSON responses with corsHeaders', () => {
    const jsonResponseCount = (source.match(/Content-Type.*application\/json/g) || []).length;
    expect(jsonResponseCount).toBeGreaterThanOrEqual(3); // static, AI, and error responses
  });

  it('should handle AI gateway errors with fallback', () => {
    expect(source).toContain('AI gateway error');
    expect(source).toContain('getStaticRecommendation');
  });

  it('should handle general errors with 500 status', () => {
    expect(source).toContain('status: 500');
    expect(source).toContain('Pricing advisor error');
  });
});
