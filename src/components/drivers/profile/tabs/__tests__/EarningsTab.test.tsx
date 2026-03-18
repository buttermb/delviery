import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { EarningsTab } from '../EarningsTab';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      __mockChain: mockChain,
    },
  };
});

vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => (
    <div data-testid="bar-chart" data-count={data.length}>{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  exportToCSV: vi.fn(),
  generateExportFilename: vi.fn(() => 'test-export.csv'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDriver: DriverProfile = {
  id: 'driver-1',
  user_id: 'user-1',
  full_name: 'John Doe',
  display_name: 'John',
  email: 'john@example.com',
  phone: '555-1234',
  vehicle_type: 'car',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_year: 2020,
  vehicle_color: 'Black',
  vehicle_plate: 'ABC123',
  zone_id: 'zone-1',
  zone_name: 'Downtown',
  status: 'active',
  availability: 'online',
  commission_rate: 25,
  is_active: true,
  is_online: true,
  notes: null,
  last_seen_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
  current_lat: null,
  current_lng: null,
};

const TENANT_ID = 'tenant-123';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderEarningsTab(
  driverOverrides: Partial<DriverProfile> = {},
  tenantId = TENANT_ID,
) {
  const driver = { ...mockDriver, ...driverOverrides };
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EarningsTab driver={driver} tenantId={tenantId} />
      </BrowserRouter>
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

  describe('rendering', () => {
    it('renders range toggle buttons', async () => {
      renderEarningsTab();

      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });

    it('renders stat cards', async () => {
      renderEarningsTab();

      expect(screen.getByText('Gross')).toBeInTheDocument();
      expect(screen.getByText('Fees')).toBeInTheDocument();
      expect(screen.getByText('Net')).toBeInTheDocument();
      expect(screen.getByText('Tips')).toBeInTheDocument();
    });

    it('renders chart section title', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText(/Daily Earnings/)).toBeInTheDocument();
      });
    });

    it('renders commission rate section', async () => {
      renderEarningsTab();

      expect(screen.getByText('Commission Rate')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('renders export section', async () => {
      renderEarningsTab();

      expect(screen.getByText('Export Earnings Report')).toBeInTheDocument();
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
    });
  });

  describe('range toggle', () => {
    it('defaults to This Week', () => {
      renderEarningsTab();

      const thisWeekBtn = screen.getByText('This Week');
      expect(thisWeekBtn).toHaveClass('bg-emerald-500');
    });

    it('switches range on click', async () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('This Month'));

      await waitFor(() => {
        expect(screen.getByText('This Month')).toHaveClass('bg-emerald-500');
      });
      expect(screen.getByText('This Week')).not.toHaveClass('bg-emerald-500');
    });
  });

  describe('chart with no earnings', () => {
    it('renders chart with zero-value bars when no earnings exist', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });

      // Chart should have bars for each day in the range (filled with $0)
      const chart = screen.getByTestId('bar-chart');
      const dayCount = Number(chart.getAttribute('data-count'));
      expect(dayCount).toBeGreaterThan(0);
    });
  });

  describe('commission rate editing', () => {
    it('shows adjust rate button', async () => {
      renderEarningsTab();

      expect(screen.getByText('Adjust rate')).toBeInTheDocument();
    });

    it('opens commission editor on click', async () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('Adjust rate'));

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('cancels editing and reverts draft rate', async () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('Adjust rate'));
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.getByText('Adjust rate')).toBeInTheDocument();
      });
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });
  });

  describe('generate report', () => {
    it('renders generate report button', async () => {
      renderEarningsTab();

      const reportBtn = screen.getByText('Generate Report');
      expect(reportBtn).toBeInTheDocument();
    });

    it('exports CSV when earnings data is loaded', async () => {
      const { exportToCSV } = await import('@/lib/utils/exportUtils');

      renderEarningsTab();

      // Wait for query to settle (returns empty data from mock)
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Generate Report'));

      // exportToCSV should be called since query returned (empty but valid) data
      expect(exportToCSV).toHaveBeenCalled();
    });
  });

  describe('default commission rate', () => {
    it('uses default 30% when commission_rate is null', () => {
      renderEarningsTab({ commission_rate: null });

      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });
});
