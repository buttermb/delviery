/**
 * set-free-tier Edge Function Credit Grant Verification
 *
 * Ensures the set-free-tier edge function grants exactly
 * FREE_TIER_MONTHLY_CREDITS (10000) credits. The edge function
 * uses a hardcoded value since it runs on Deno and cannot
 * import from the app — this test guards against drift.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FREE_TIER_MONTHLY_CREDITS } from '../creditCosts';

/**
 * Parse the hardcoded p_amount value from the set-free-tier edge function source.
 * Matches the pattern: p_amount: <number>
 */
function extractGrantAmount(source: string): number | null {
  const match = source.match(/p_amount:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse the credits_granted value from the success response.
 * Matches the pattern: credits_granted: <number>
 */
function extractResponseCredits(source: string): number | null {
  const match = source.match(/credits_granted:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

describe('set-free-tier Edge Function Credit Grant', () => {
  const edgeFnPath = resolve(
    __dirname,
    '../../../../supabase/functions/set-free-tier/index.ts'
  );

  let source: string;

  try {
    source = readFileSync(edgeFnPath, 'utf-8');
  } catch {
    source = '';
  }

  it('should be readable from disk', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('should grant exactly FREE_TIER_MONTHLY_CREDITS (10000) via RPC', () => {
    const grantAmount = extractGrantAmount(source);
    expect(grantAmount).toBe(FREE_TIER_MONTHLY_CREDITS);
    expect(grantAmount).toBe(10000);
  });

  it('should return credits_granted matching FREE_TIER_MONTHLY_CREDITS in response', () => {
    const responseCredits = extractResponseCredits(source);
    expect(responseCredits).toBe(FREE_TIER_MONTHLY_CREDITS);
    expect(responseCredits).toBe(10000);
  });

  it('should have a comment documenting the constant linkage', () => {
    expect(source).toContain('FREE_TIER_MONTHLY_CREDITS');
  });

  it('should call grant_free_credits RPC', () => {
    expect(source).toContain("rpc('grant_free_credits'");
  });
});

describe('grant_free_credits RPC Default', () => {
  const migrationPath = resolve(
    __dirname,
    '../../../../supabase/migrations/20260102221036_0cea7dd3-f85d-429c-9db6-46e59aea8f80.sql'
  );

  let sql: string;

  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch {
    sql = '';
  }

  it('should be readable from disk', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('should default p_amount to FREE_TIER_MONTHLY_CREDITS (10000)', () => {
    expect(sql).toContain('p_amount INTEGER DEFAULT 10000');
  });

  it('should cap monthly grants at FREE_TIER_MONTHLY_CREDITS (10000)', () => {
    expect(sql).toContain('v_max_monthly_grant INTEGER := 10000');
  });
});
