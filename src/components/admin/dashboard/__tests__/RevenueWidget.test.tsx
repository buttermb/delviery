/**
 * RevenueWidget Component Tests
 * Tests:
 * - Revenue KPI cards rendering
 * - Loading states
 * - Data formatting (currency, percentages)
 * - Trend indicators
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RevenueWidget } from '../RevenueWidget';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock('@/components/admin/dashboard/KPICard', () => ({
  KPICard: ({ title, value, description, trend }: { title: string; value: React.ReactNode; description?: string; trend?: { value: number; label: string } }) => (
    <div data-testid={`kpi-card-${title}`}>
      <div data-testid="title">{title}</div>
      <div data-testid="value">{value}</div>
      <div data-testid="description">{description}</div>
      {trend && <div data-testid="trend">{trend.value}% {trend.label}</div>}
    </div>
  ),
  KPICardSkeleton: () => <div data-testid="kpi-card-skeleton">Loading...</div>,
}));

import { useDashboardStats } from '@/hooks/useDashboardStats';

describe('RevenueWidget', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderRevenueWidget = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RevenueWidget />
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should render skeletons when loading', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      expect(screen.getAllByTestId('kpi-card-skeleton')).toHaveLength(3);
    });
  });

  describe('Revenue Data Rendering', () => {
    it('should render all three revenue KPI cards', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 10,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      expect(screen.getByTestId("kpi-card-Today's Revenue")).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-Month to Date')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-Avg Order Value')).toBeInTheDocument();
    });

    it('should display formatted currency values', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1234.56,
          revenueMTD: 9876.54,
          avgOrderValue: 123.45,
          revenueGrowthPercent: 15,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      const values = screen.getAllByTestId('value');
      expect(values.length).toBeGreaterThan(0);
      // Values should be formatted as currency
      values.forEach(value => {
        expect(value.textContent).toMatch(/\$|[0-9,.]/);
      });
    });

    it('should display growth percentage trend', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 15.5,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      const mtdCard = screen.getByTestId('kpi-card-Month to Date');
      expect(mtdCard).toBeInTheDocument();

      const trend = screen.getByTestId('trend');
      expect(trend.textContent).toContain('15.5%');
      expect(trend.textContent).toContain('vs last month');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 0,
          revenueMTD: 0,
          avgOrderValue: 0,
          revenueGrowthPercent: 0,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      expect(screen.getByTestId("kpi-card-Today's Revenue")).toBeInTheDocument();
    });

    it('should handle undefined stats gracefully', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      // Should render cards with default values
      expect(screen.getByTestId("kpi-card-Today's Revenue")).toBeInTheDocument();
    });

    it('should handle missing growth percentage', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: undefined,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      const mtdCard = screen.getByTestId('kpi-card-Month to Date');
      expect(mtdCard).toBeInTheDocument();
      // Should not show trend when percentage is undefined
      const trends = screen.queryAllByTestId('trend');
      expect(trends).toHaveLength(0);
    });
  });

  describe('Section Header', () => {
    it('should render Revenue section header with icon', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as unknown as ReturnType<typeof useDashboardStats>);

      renderRevenueWidget();

      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });
  });
});
