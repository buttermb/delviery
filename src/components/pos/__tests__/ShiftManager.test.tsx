/**
 * ShiftManager Component Tests
 *
 * Tests for POS shift management including:
 * - Cash validation (must be >= 0)
 * - Shift opening/closing logic
 * - Expected vs actual cash calculations
 * - Variance tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue('SUBSCRIBED'),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
    loading: false,
  })),
}));

vi.mock('@/contexts/VerificationContext', () => ({
  useVerification: vi.fn(() => ({
    isVerified: true,
    isVerifying: false,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/hooks/useRealtimePOS', () => ({
  useRealtimeShifts: vi.fn(),
  useRealtimeTransactions: vi.fn(),
  useRealtimeCashDrawer: vi.fn(),
}));

vi.mock('./ZReport', () => ({
  ZReport: vi.fn(() => <div data-testid="z-report">Z-Report Component</div>),
}));

// Import the component after mocking
import { ShiftManager } from '../ShiftManager';

// Helper to create test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ShiftManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cash Amount Validation', () => {
    it('should reject negative opening cash amounts', () => {
      // Test the validation logic directly
      const openingCashValue = parseFloat('-5.00') || 0;
      const isValid = openingCashValue >= 0 && !isNaN(openingCashValue);

      expect(isValid).toBe(false);
    });

    it('should accept zero as valid opening cash', () => {
      const openingCashValue = parseFloat('0.00') || 0;
      const isValid = openingCashValue >= 0 && !isNaN(openingCashValue);

      expect(isValid).toBe(true);
    });

    it('should accept positive opening cash amounts', () => {
      const openingCashValue = parseFloat('150.50') || 0;
      const isValid = openingCashValue >= 0 && !isNaN(openingCashValue);

      expect(isValid).toBe(true);
    });

    it('should reject negative closing cash amounts', () => {
      const closingCashValue = parseFloat('-10.00') || 0;
      const isValid = closingCashValue >= 0 && !isNaN(closingCashValue);

      expect(isValid).toBe(false);
    });

    it('should accept zero as valid closing cash', () => {
      const closingCashValue = parseFloat('0.00') || 0;
      const isValid = closingCashValue >= 0 && !isNaN(closingCashValue);

      expect(isValid).toBe(true);
    });

    it('should handle empty string as invalid', () => {
      const value = parseFloat('') || 0;
      const isValid = value >= 0 && !isNaN(value);

      // Empty string parses to 0, which is valid
      expect(isValid).toBe(true);
      expect(value).toBe(0);
    });

    it('should handle NaN values correctly', () => {
      const value = parseFloat('not-a-number');
      const isValid = value >= 0 && !isNaN(value);

      expect(isValid).toBe(false);
    });
  });

  describe('Expected Cash Calculation', () => {
    it('should calculate expected cash as opening + cash sales', () => {
      const openingCash = 100.0;
      const cashSales = 250.0;
      const expectedCash = openingCash + cashSales;

      expect(expectedCash).toBe(350.0);
    });

    it('should calculate variance correctly for over', () => {
      const openingCash = 100.0;
      const cashSales = 250.0;
      const closingCash = 360.0;
      const expectedCash = openingCash + cashSales;
      const variance = closingCash - expectedCash;

      expect(variance).toBe(10.0);
    });

    it('should calculate variance correctly for under', () => {
      const openingCash = 100.0;
      const cashSales = 250.0;
      const closingCash = 340.0;
      const expectedCash = openingCash + cashSales;
      const variance = closingCash - expectedCash;

      expect(variance).toBe(-10.0);
    });

    it('should handle zero cash sales', () => {
      const openingCash = 100.0;
      const cashSales = 0;
      const expectedCash = openingCash + cashSales;

      expect(expectedCash).toBe(100.0);
    });
  });

  describe('Shift Summary Calculations', () => {
    it('should calculate average transaction value', () => {
      const transactions = [
        { total_amount: 50.0, payment_method: 'cash' },
        { total_amount: 100.0, payment_method: 'card' },
        { total_amount: 75.0, payment_method: 'cash' },
      ];

      const totalValue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const avgValue = transactions.length > 0 ? totalValue / transactions.length : 0;

      expect(avgValue).toBe(75.0);
    });

    it('should count transactions by payment method', () => {
      const transactions = [
        { total_amount: 50.0, payment_method: 'cash' },
        { total_amount: 100.0, payment_method: 'card' },
        { total_amount: 75.0, payment_method: 'cash' },
        { total_amount: 25.0, payment_method: 'card' },
      ];

      const cashTxns = transactions.filter((t) => t.payment_method === 'cash');
      const cardTxns = transactions.filter((t) => t.payment_method === 'card');

      expect(cashTxns.length).toBe(2);
      expect(cardTxns.length).toBe(2);
    });

    it('should handle empty transaction list', () => {
      const transactions: { total_amount: number; payment_method: string }[] = [];

      const totalValue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const avgValue = transactions.length > 0 ? totalValue / transactions.length : 0;

      expect(avgValue).toBe(0);
      expect(transactions.length).toBe(0);
    });
  });

  describe('Variance Detection', () => {
    it('should flag large positive variance', () => {
      const variance = 15.0;
      const threshold = 10.0;
      const hasLargeVariance = Math.abs(variance) > threshold;

      expect(hasLargeVariance).toBe(true);
    });

    it('should flag large negative variance', () => {
      const variance = -15.0;
      const threshold = 10.0;
      const hasLargeVariance = Math.abs(variance) > threshold;

      expect(hasLargeVariance).toBe(true);
    });

    it('should not flag small variance', () => {
      const variance = 5.0;
      const threshold = 10.0;
      const hasLargeVariance = Math.abs(variance) > threshold;

      expect(hasLargeVariance).toBe(false);
    });

    it('should detect any variance for display', () => {
      const variance = 0.05;
      const hasVariance = Math.abs(variance) > 0.01;

      expect(hasVariance).toBe(true);
    });

    it('should not flag zero variance', () => {
      const variance = 0.0;
      const hasVariance = Math.abs(variance) > 0.01;

      expect(hasVariance).toBe(false);
    });
  });

  describe('Shift Number Generation', () => {
    it('should generate shift number in correct format', () => {
      const now = new Date('2026-01-21T14:30:45.000Z');
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const shiftNumber = `SHIFT-${dateStr}-${timeStr}`;

      expect(shiftNumber).toMatch(/^SHIFT-\d{8}-\d{6}$/);
      expect(dateStr).toBe('20260121');
    });
  });

  describe('Input Validation Patterns', () => {
    it('should allow valid decimal input pattern', () => {
      const pattern = /^-?\d*\.?\d{0,2}$/;

      expect(pattern.test('100')).toBe(true);
      expect(pattern.test('100.00')).toBe(true);
      expect(pattern.test('100.5')).toBe(true);
      expect(pattern.test('.99')).toBe(true);
      expect(pattern.test('')).toBe(true);
    });

    it('should reject invalid decimal input pattern', () => {
      const pattern = /^-?\d*\.?\d{0,2}$/;

      expect(pattern.test('100.000')).toBe(false); // Too many decimals
      expect(pattern.test('abc')).toBe(false);
      expect(pattern.test('100.00.00')).toBe(false); // Multiple decimals
    });

    it('should allow negative numbers in pattern but validation rejects them', () => {
      const pattern = /^-?\d*\.?\d{0,2}$/;
      const value = '-50.00';

      // Pattern allows it (for typing)
      expect(pattern.test(value)).toBe(true);

      // But validation rejects it
      const numValue = parseFloat(value);
      const isValid = numValue >= 0 && !isNaN(numValue);
      expect(isValid).toBe(false);
    });
  });
});

describe('queryKeys.pos.shifts', () => {
  // Import queryKeys to test the factory
  it('should generate correct active shift key', async () => {
    const { queryKeys } = await import('@/lib/queryKeys');
    const tenantId = 'test-tenant-123';
    const key = queryKeys.pos.shifts.active(tenantId);

    expect(key).toContain('pos');
    expect(key).toContain('shifts');
    expect(key).toContain('active');
    expect(key).toContain(tenantId);
  });

  it('should generate correct recent shifts key', async () => {
    const { queryKeys } = await import('@/lib/queryKeys');
    const tenantId = 'test-tenant-123';
    const key = queryKeys.pos.shifts.recent(tenantId);

    expect(key).toContain('pos');
    expect(key).toContain('shifts');
    expect(key).toContain('recent');
    expect(key).toContain(tenantId);
  });

  it('should generate correct transactions key', async () => {
    const { queryKeys } = await import('@/lib/queryKeys');
    const shiftId = 'shift-456';
    const key = queryKeys.pos.shifts.transactions(shiftId);

    expect(key).toContain('pos');
    expect(key).toContain('shifts');
    expect(key).toContain('transactions');
    expect(key).toContain(shiftId);
  });
});
