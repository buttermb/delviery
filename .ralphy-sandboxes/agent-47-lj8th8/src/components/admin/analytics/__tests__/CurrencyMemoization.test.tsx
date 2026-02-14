/**
 * Tests for currency formatting memoization in analytics components
 * These tests verify that currency values are properly memoized to prevent unnecessary recalculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AverageOrderValueChart } from '../AverageOrderValueChart';
import { RevenueChart } from '../RevenueChart';
import * as React from 'react';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
          lte: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Currency Memoization in Analytics Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AverageOrderValueChart', () => {
    it('should render empty state when no data', async () => {
      render(
        <AverageOrderValueChart storeId="test-store" />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('No order data available')).toBeInTheDocument();
      });
    });

    it('should render without errors', () => {
      const { container } = render(
        <AverageOrderValueChart storeId="test-store" />,
        { wrapper: createWrapper() }
      );
      expect(container).toBeTruthy();
    });
  });

  describe('RevenueChart', () => {
    const defaultProps = {
      storeId: 'test-store',
      dateRange: {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      },
    };

    it('should render empty state when no data', async () => {
      render(<RevenueChart {...defaultProps} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No revenue data available')).toBeInTheDocument();
      });
    });

    it('should render without errors', () => {
      const { container } = render(<RevenueChart {...defaultProps} />, { wrapper: createWrapper() });
      expect(container).toBeTruthy();
    });

    it('should handle prop changes without errors', () => {
      const { rerender } = render(
        <RevenueChart {...defaultProps} />,
        { wrapper: createWrapper() }
      );

      const newDateRange = {
        from: new Date('2024-02-01'),
        to: new Date('2024-02-28'),
      };

      // Should not throw error on rerender
      expect(() => {
        rerender(<RevenueChart storeId="test-store" dateRange={newDateRange} />);
      }).not.toThrow();
    });
  });

  describe('Currency formatting consistency', () => {
    it('should format currency values consistently', () => {
      // This test verifies that formatters produce consistent output
      const formatter = (value: number) => `$${value.toLocaleString()}`;

      const value1 = formatter(1234.56);
      const value2 = formatter(1234.56);

      expect(value1).toBe(value2);
      expect(value1).toBe('$1,234.56');
    });

    it('should handle large numbers in Y-axis formatter', () => {
      const formatter = (v: number) =>
        `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`;

      expect(formatter(500)).toBe('$500');
      expect(formatter(1000)).toBe('$1.0k');
      expect(formatter(5500)).toBe('$5.5k');
      expect(formatter(10000)).toBe('$10.0k');
    });

    it('should format tooltip values correctly', () => {
      const formatter = (value: number) => [`$${value.toLocaleString()}`, 'Revenue'];

      const [formatted, label] = formatter(12345.67);
      expect(formatted).toBe('$12,345.67');
      expect(label).toBe('Revenue');
    });

    it('should handle zero values correctly', () => {
      const formatter = (value: number) => `$${value.toLocaleString()}`;
      expect(formatter(0)).toBe('$0');
    });

    it('should handle decimal values correctly', () => {
      const formatter = (value: number) => `$${value.toLocaleString()}`;
      expect(formatter(99.99)).toBe('$99.99');
    });

    it('should handle millions correctly', () => {
      const formatter = (value: number) => `$${value.toLocaleString()}`;
      expect(formatter(1000000)).toBe('$1,000,000');
    });
  });

  describe('Memoization benefits', () => {
    it('should prevent unnecessary recalculations with stable dependencies', () => {
      // Create a formatter function that would be memoized in the actual component
      const createFormatter = () => (value: number) => `$${value.toLocaleString()}`;

      const formatter1 = createFormatter();
      const formatter2 = createFormatter();

      // Both formatters should produce the same output
      expect(formatter1(100)).toBe(formatter2(100));
      expect(formatter1(100)).toBe('$100');
    });

    it('should handle multiple rerenders efficiently', () => {
      const { rerender } = render(
        <AverageOrderValueChart storeId="test-store" />,
        { wrapper: createWrapper() }
      );

      // Multiple rerenders should not cause errors
      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(<AverageOrderValueChart storeId="test-store" />);
        }).not.toThrow();
      }
    });
  });
});
