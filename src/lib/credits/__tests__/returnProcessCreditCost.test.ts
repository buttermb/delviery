/**
 * Return Process Credit Cost Tests
 *
 * Verifies that the return_process action key is properly configured
 * in the credit costs system with the expected 15 credit cost.
 */

import { describe, it, expect } from 'vitest';
import { getCreditCost, getCreditCostInfo, CREDIT_COSTS } from '../creditCosts';

describe('return_process credit cost configuration', () => {
  it('should have return_process defined in CREDIT_COSTS', () => {
    expect(CREDIT_COSTS).toHaveProperty('return_process');
  });

  it('should cost exactly 15 credits', () => {
    expect(getCreditCost('return_process')).toBe(15);
  });

  it('should have correct metadata', () => {
    const info = getCreditCostInfo('return_process');

    expect(info).not.toBeNull();
    expect(info?.actionKey).toBe('return_process');
    expect(info?.actionName).toBe('Process Return');
    expect(info?.credits).toBe(15);
    expect(info?.category).toBe('operations');
  });

  it('should be in the operations category', () => {
    const info = getCreditCostInfo('return_process');
    expect(info?.category).toBe('operations');
  });
});
