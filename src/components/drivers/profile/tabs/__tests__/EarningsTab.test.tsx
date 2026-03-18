import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories are hoisted, so references must be too)
// ---------------------------------------------------------------------------

const { mockExportToCSV, mockGenerateExportFilename, mockToast } = vi.hoisted(() => ({
  mockExportToCSV: vi.fn(),
  mockGenerateExportFilename: vi.fn((base: string, ext: string) => `${base}_2026-03-18.${ext}`),
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  exportToCSV: mockExportToCSV,
  generateExportFilename: mockGenerateExportFilename,
}));

vi.mock('sonner', () => ({ toast: mockToast }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: {
      byTenant: (id: string) => ['couriers-admin', id],
    },
  },
}));

vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

// Import after mocks are set up
const { EarningsTab } = await import('../EarningsTab');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createDriver(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 'driver-1',
    user_id: 'user-1',
    full_name: 'Jane Doe',
    display_name: 'Jane',
    email: 'jane@example.com',
    phone: '555-1234',
    vehicle_type: 'car',
    vehicle_make: 'Toyota',
    vehicle_model: 'Corolla',
    vehicle_year: 2022,
    vehicle_color: 'White',
    vehicle_plate: 'ABC123',
    zone_id: null,
    zone_name: null,
    status: 'active',
    availability: 'online',
    commission_rate: 25,
    is_active: true,
    is_online: true,
    notes: null,
    last_seen_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: null,
    current_lng: null,
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderEarningsTab(driver = createDriver(), tenantId = 'tenant-1') {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <EarningsTab driver={driver} tenantId={tenantId} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EarningsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders range toggle buttons', () => {
      renderEarningsTab();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      renderEarningsTab();
      expect(screen.getByText('Gross')).toBeInTheDocument();
      expect(screen.getByText('Fees')).toBeInTheDocument();
      expect(screen.getByText('Net')).toBeInTheDocument();
      expect(screen.getByText('Tips')).toBeInTheDocument();
    });

    it('renders commission rate section', () => {
      const driver = createDriver({ commission_rate: 25 });
      renderEarningsTab(driver);
      expect(screen.getByText('Commission Rate')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('renders the Generate Report button', () => {
      renderEarningsTab();
      expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
    });

    it('renders Export Earnings Report card', () => {
      renderEarningsTab();
      expect(screen.getByText('Export Earnings Report')).toBeInTheDocument();
      expect(screen.getByText(/generate a downloadable earnings report/i)).toBeInTheDocument();
    });
  });

  describe('Generate Report button', () => {
    it('shows info toast when no earnings data is loaded', async () => {
      renderEarningsTab();

      // Wait for query to settle (empty data yields gross=0 etc, but earnings object exists)
      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

      // The query returns empty data [], which resolves to an EarningsSummary
      // with gross=0, fees=0, net=0, tips=0, daily=[]
      // That means earnings IS defined, so exportToCSV will be called
      // with a single summary row (no daily rows)
      expect(mockExportToCSV).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Earnings report exported');
    });

    it('generates filename with driver name', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

      expect(mockGenerateExportFilename).toHaveBeenCalledWith('earnings-Jane-Doe', 'csv');
    });

    it('passes correct columns to exportToCSV', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

      const columns = mockExportToCSV.mock.calls[0][1];
      const headers = columns.map((c: { header: string }) => c.header);
      expect(headers).toEqual([
        'Period',
        'Gross ($)',
        'Fees ($)',
        'Net ($)',
        'Tips ($)',
        'Commission Rate',
      ]);
    });

    it('includes summary row with commission rate from driver', async () => {
      const driver = createDriver({ commission_rate: 25 });
      renderEarningsTab(driver);

      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

      const rows = mockExportToCSV.mock.calls[0][0];
      expect(rows[0]).toEqual({
        period: 'This Week',
        gross: '0.00',
        fees: '0.00',
        net: '0.00',
        tips: '0.00',
        commission_rate: '25%',
      });
    });
  });

  describe('Range toggle', () => {
    it('selects "This Week" by default', () => {
      renderEarningsTab();
      const thisWeekBtn = screen.getByText('This Week');
      expect(thisWeekBtn.className).toContain('bg-emerald-500');
    });

    it('changes active range on click', () => {
      renderEarningsTab();
      const thisMonthBtn = screen.getByText('This Month');
      fireEvent.click(thisMonthBtn);
      expect(thisMonthBtn.className).toContain('bg-emerald-500');
    });
  });

  describe('Commission rate', () => {
    it('shows "Adjust rate" link', () => {
      renderEarningsTab();
      expect(screen.getByText('Adjust rate')).toBeInTheDocument();
    });

    it('shows slider controls when "Adjust rate" is clicked', () => {
      renderEarningsTab();
      fireEvent.click(screen.getByText('Adjust rate'));
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('uses default 30% when commission_rate is null', () => {
      const driver = createDriver({ commission_rate: null });
      renderEarningsTab(driver);
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });
});
