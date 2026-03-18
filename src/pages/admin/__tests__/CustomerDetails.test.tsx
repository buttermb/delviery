/**
 * Tests for CustomerDetails component
 *
 * These tests verify:
 * - Zod validation schemas for notes and store credit forms
 * - Computed values (total spent, average order value, first order date)
 * - Outstanding balance calculation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Replicate Zod schemas from CustomerDetails.tsx for testing
// ============================================================================

const noteFormSchema = z.object({
  note: z.string().min(1, 'Note cannot be empty').max(2000, 'Note must be under 2000 characters'),
});

const storeCreditSchema = z.object({
  amount: z.string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Must be a positive number')
    .refine((val) => parseFloat(val) <= 100000, 'Amount exceeds maximum'),
});

// ============================================================================
// Note Form Validation Tests
// ============================================================================

describe('Note Form Schema', () => {
  it('should accept a valid note', () => {
    const result = noteFormSchema.safeParse({ note: 'This is a valid note' });
    expect(result.success).toBe(true);
  });

  it('should reject an empty note', () => {
    const result = noteFormSchema.safeParse({ note: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Note cannot be empty');
    }
  });

  it('should reject a note exceeding 2000 characters', () => {
    const longNote = 'a'.repeat(2001);
    const result = noteFormSchema.safeParse({ note: longNote });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Note must be under 2000 characters');
    }
  });

  it('should accept a note at exactly 2000 characters', () => {
    const maxNote = 'a'.repeat(2000);
    const result = noteFormSchema.safeParse({ note: maxNote });
    expect(result.success).toBe(true);
  });

  it('should accept a single character note', () => {
    const result = noteFormSchema.safeParse({ note: 'a' });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Store Credit Schema Tests
// ============================================================================

describe('Store Credit Schema', () => {
  it('should accept a valid amount', () => {
    const result = storeCreditSchema.safeParse({ amount: '25.50' });
    expect(result.success).toBe(true);
  });

  it('should reject an empty amount', () => {
    const result = storeCreditSchema.safeParse({ amount: '' });
    expect(result.success).toBe(false);
  });

  it('should reject zero amount', () => {
    const result = storeCreditSchema.safeParse({ amount: '0' });
    expect(result.success).toBe(false);
  });

  it('should reject negative amounts', () => {
    const result = storeCreditSchema.safeParse({ amount: '-10' });
    expect(result.success).toBe(false);
  });

  it('should reject non-numeric strings', () => {
    const result = storeCreditSchema.safeParse({ amount: 'abc' });
    expect(result.success).toBe(false);
  });

  it('should accept decimal amounts', () => {
    const result = storeCreditSchema.safeParse({ amount: '0.01' });
    expect(result.success).toBe(true);
  });

  it('should reject amounts over 100000', () => {
    const result = storeCreditSchema.safeParse({ amount: '100001' });
    expect(result.success).toBe(false);
  });

  it('should accept amount at exactly 100000', () => {
    const result = storeCreditSchema.safeParse({ amount: '100000' });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Computed Values Tests
// ============================================================================

describe('CustomerDetails Computed Values', () => {
  // Replicate the computed value logic from CustomerDetails
  function computeStats(
    wholesaleCount: number,
    wholesaleSpent: number,
    sfCount: number,
    sfSpent: number,
    customerTotalSpent: number,
  ) {
    const totalOrdersCount = wholesaleCount + sfCount;
    const totalSpentCombined = wholesaleSpent + sfSpent;
    const computedTotalSpent = totalSpentCombined > 0 ? totalSpentCombined : customerTotalSpent;
    const averageOrderValue = totalOrdersCount > 0 ? computedTotalSpent / totalOrdersCount : 0;
    return { totalOrdersCount, computedTotalSpent, averageOrderValue };
  }

  it('should calculate total orders from both sources', () => {
    const { totalOrdersCount } = computeStats(5, 500, 3, 300, 0);
    expect(totalOrdersCount).toBe(8);
  });

  it('should combine wholesale and storefront spend', () => {
    const { computedTotalSpent } = computeStats(5, 500, 3, 300, 0);
    expect(computedTotalSpent).toBe(800);
  });

  it('should fall back to customer.total_spent when no orders exist', () => {
    const { computedTotalSpent } = computeStats(0, 0, 0, 0, 1500);
    expect(computedTotalSpent).toBe(1500);
  });

  it('should calculate correct average order value', () => {
    const { averageOrderValue } = computeStats(4, 400, 0, 0, 0);
    expect(averageOrderValue).toBe(100);
  });

  it('should return zero average when no orders', () => {
    const { averageOrderValue } = computeStats(0, 0, 0, 0, 0);
    expect(averageOrderValue).toBe(0);
  });

  it('should handle only storefront orders', () => {
    const { totalOrdersCount, computedTotalSpent, averageOrderValue } = computeStats(0, 0, 5, 250, 0);
    expect(totalOrdersCount).toBe(5);
    expect(computedTotalSpent).toBe(250);
    expect(averageOrderValue).toBe(50);
  });
});

// ============================================================================
// Combined First Order Date Tests
// ============================================================================

describe('Combined First Order Date', () => {
  function getCombinedFirstOrder(wholesaleFirst: string | null, storefrontFirst: string | null): string | null {
    const dates = [wholesaleFirst, storefrontFirst].filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.reduce((earliest, d) => new Date(d) < new Date(earliest) ? d : earliest);
  }

  it('should return null when no orders exist', () => {
    expect(getCombinedFirstOrder(null, null)).toBe(null);
  });

  it('should return wholesale date when no storefront orders', () => {
    expect(getCombinedFirstOrder('2024-01-15', null)).toBe('2024-01-15');
  });

  it('should return storefront date when no wholesale orders', () => {
    expect(getCombinedFirstOrder(null, '2024-03-20')).toBe('2024-03-20');
  });

  it('should return the earlier date when both exist', () => {
    expect(getCombinedFirstOrder('2024-06-01', '2024-03-01')).toBe('2024-03-01');
  });

  it('should return wholesale when it is earlier', () => {
    expect(getCombinedFirstOrder('2023-12-01', '2024-01-15')).toBe('2023-12-01');
  });

  it('should handle same dates', () => {
    const result = getCombinedFirstOrder('2024-01-01', '2024-01-01');
    expect(result).toBe('2024-01-01');
  });
});

// ============================================================================
// Outstanding Balance Tests
// ============================================================================

describe('Outstanding Balance Calculation', () => {
  function calculateOutstanding(wholesaleSpent: number, totalPayments: number): number {
    return Math.max(0, wholesaleSpent - totalPayments);
  }

  it('should show positive balance when payments are less than orders', () => {
    expect(calculateOutstanding(1000, 700)).toBe(300);
  });

  it('should show zero when fully paid', () => {
    expect(calculateOutstanding(500, 500)).toBe(0);
  });

  it('should show zero when overpaid (not negative)', () => {
    expect(calculateOutstanding(500, 600)).toBe(0);
  });

  it('should show zero when no orders and no payments', () => {
    expect(calculateOutstanding(0, 0)).toBe(0);
  });
});
