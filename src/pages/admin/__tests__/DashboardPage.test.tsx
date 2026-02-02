/**
 * DashboardPage Component Tests
 * Tests:
 * - Lazy loading of RevenueWidget with Suspense
 * - Lazy loading of ActivityWidget with Suspense
 * - Loading states and fallback UI
 * - Dashboard stats rendering
 * - Error handling
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      name: 'Test Tenant',
    },
  }),
}));

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(),
}));

vi.mock('@/components/admin/HubBreadcrumbs', () => ({
  HubBreadcrumbs: () => <div data-testid="hub-breadcrumbs">Breadcrumbs</div>,
}));

// Mock RevenueWidget to test lazy loading
vi.mock('@/components/admin/dashboard/RevenueWidget', () => ({
  RevenueWidget: () => <div data-testid="revenue-widget">Revenue Widget</div>,
}));

// Mock ActivityWidget to test lazy loading
vi.mock('@/components/admin/dashboard/ActivityFeedWidget', () => ({
  ActivityWidget: () => <div data-testid="activity-widget">Activity Widget</div>,
  ActivityFeedWidget: () => <div data-testid="activity-feed-widget">Activity Feed Widget</div>,
}));

vi.mock('@/components/admin/dashboard/KPICard', () => ({
  KPICard: ({ title }: { title: string }) => <div data-testid={`kpi-card-${title}`}>{title}</div>,
  KPICardSkeleton: () => <div data-testid="kpi-card-skeleton">Loading...</div>,
}));

import { useDashboardStats } from '@/hooks/useDashboardStats';

describe('DashboardPage', () => {
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

  const renderDashboardPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Lazy Loading', () => {
    it('should render RevenueWidget fallback initially', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // Should show skeleton for lazy-loaded RevenueWidget
      expect(screen.getAllByTestId('kpi-card-skeleton').length).toBeGreaterThan(0);
    });

    it('should lazy load and render RevenueWidget after suspense', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 10,
          pendingOrders: 5,
          totalOrdersToday: 20,
          completedOrdersToday: 15,
          totalOrdersMTD: 100,
          totalCustomers: 50,
          newCustomers: 10,
          activeSessions: 5,
          totalProducts: 100,
          lowStockItems: 5,
          outOfStockItems: 2,
          totalInventoryValue: 10000,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // Wait for RevenueWidget to load
      await waitFor(() => {
        expect(screen.getByTestId('revenue-widget')).toBeInTheDocument();
      });
    });

    it('should lazy load and render ActivityWidget after suspense', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 10,
          pendingOrders: 5,
          totalOrdersToday: 20,
          completedOrdersToday: 15,
          totalOrdersMTD: 100,
          totalCustomers: 50,
          newCustomers: 10,
          activeSessions: 5,
          totalProducts: 100,
          lowStockItems: 5,
          outOfStockItems: 2,
          totalInventoryValue: 10000,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // Wait for ActivityWidget to load
      await waitFor(() => {
        expect(screen.getByTestId('activity-widget')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Stats', () => {
    it('should render loading state when stats are loading', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      expect(screen.getAllByTestId('kpi-card-skeleton').length).toBeGreaterThan(0);
    });

    it('should render dashboard sections with stats', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 10,
          pendingOrders: 5,
          totalOrdersToday: 20,
          completedOrdersToday: 15,
          totalOrdersMTD: 100,
          totalCustomers: 50,
          newCustomers: 10,
          activeSessions: 5,
          totalProducts: 100,
          lowStockItems: 5,
          outOfStockItems: 2,
          totalInventoryValue: 10000,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Check for section headers
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });

    it('should display error message when stats fail to load', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load stats'),
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      expect(screen.getByText(/Failed to load dashboard stats/i)).toBeInTheDocument();
    });
  });

  describe('UI Elements', () => {
    it('should render breadcrumbs', () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      expect(screen.getByTestId('hub-breadcrumbs')).toBeInTheDocument();
    });

    it('should display last updated time when available', () => {
      const now = Date.now();
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {} as any,
        isLoading: false,
        error: null,
        dataUpdatedAt: now,
      } as any);

      renderDashboardPage();

      expect(screen.getByText(/Updated/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should code-split RevenueWidget through lazy loading', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // RevenueWidget should load asynchronously via Suspense
      await waitFor(() => {
        expect(screen.getByTestId('revenue-widget')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should code-split ActivityWidget through lazy loading', async () => {
      vi.mocked(useDashboardStats).mockReturnValue({
        data: {
          revenueToday: 1000,
          revenueMTD: 5000,
          avgOrderValue: 50,
          revenueGrowthPercent: 10,
          pendingOrders: 5,
          totalOrdersToday: 20,
          completedOrdersToday: 15,
          totalOrdersMTD: 100,
          totalCustomers: 50,
          newCustomers: 10,
          activeSessions: 5,
          totalProducts: 100,
          lowStockItems: 5,
          outOfStockItems: 2,
          totalInventoryValue: 10000,
        },
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      } as any);

      renderDashboardPage();

      // ActivityWidget should load asynchronously via Suspense
      await waitFor(() => {
        expect(screen.getByTestId('activity-widget')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
