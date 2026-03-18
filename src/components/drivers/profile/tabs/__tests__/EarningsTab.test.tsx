import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EarningsTab } from '../EarningsTab';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { exportToCSV } from '@/lib/utils/exportUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockCourierEq1 = vi.fn();
const mockCourierEq2 = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'courier_earnings') {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              gte: mockGte.mockReturnValue({
                lte: mockLte.mockReturnValue({
                  order: mockOrder,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'couriers') {
        return {
          update: mockUpdate.mockReturnValue({
            eq: mockCourierEq1.mockReturnValue({
              eq: mockCourierEq2.mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  exportToCSV: vi.fn(),
  generateExportFilename: vi.fn(() => 'earnings-test-driver.csv'),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock recharts to avoid rendering issues in JSDOM
vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data.length}>{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: {
    value: number[];
    onValueChange: (val: number[]) => void;
    [key: string]: unknown;
  }) => (
    <input
      data-testid="slider"
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      {...props}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const mockDriver: DriverProfile = {
  id: 'driver-123',
  user_id: 'user-456',
  full_name: 'Jane Doe',
  display_name: 'Jane',
  email: 'jane@example.com',
  phone: '555-0100',
  vehicle_type: 'car',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_year: 2022,
  vehicle_color: 'White',
  vehicle_plate: 'ABC1234',
  zone_id: 'zone-1',
  zone_name: 'Downtown',
  status: 'active',
  availability: 'online',
  commission_rate: 25,
  is_active: true,
  is_online: true,
  notes: null,
  last_seen_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
  current_lat: null,
  current_lng: null,
};

const TENANT_ID = 'tenant-abc';

function renderEarningsTab(driverOverrides?: Partial<DriverProfile>) {
  const queryClient = createQueryClient();
  const driver = { ...mockDriver, ...driverOverrides };
  return render(
    <QueryClientProvider client={queryClient}>
      <EarningsTab driver={driver} tenantId={TENANT_ID} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EarningsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolve with empty data
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  describe('Rendering', () => {
    it('renders range toggle buttons', () => {
      renderEarningsTab();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });

    it('renders stat card labels', async () => {
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByText('Gross')).toBeInTheDocument();
        expect(screen.getByText('Fees')).toBeInTheDocument();
        expect(screen.getByText('Net')).toBeInTheDocument();
        expect(screen.getByText('Tips')).toBeInTheDocument();
      });
    });

    it('renders commission rate section', async () => {
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByText('Commission Rate')).toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });

    it('renders export section', () => {
      renderEarningsTab();
      expect(screen.getByText('Export Earnings Report')).toBeInTheDocument();
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
    });
  });

  describe('Data fetching', () => {
    it('queries courier_earnings with driver id', async () => {
      renderEarningsTab();
      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalled();
        expect(mockEq).toHaveBeenCalledWith('courier_id', 'driver-123');
      });
    });

    it('shows $0 values when no earnings data exists', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      renderEarningsTab();
      await waitFor(() => {
        // Gross, Net, Tips all show $0 (Fees shows -$0)
        const zeroValues = screen.getAllByText('$0');
        expect(zeroValues.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('shows computed values from real data', async () => {
      mockOrder.mockResolvedValue({
        data: [
          { total_earned: 100, commission_amount: 30, tip_amount: 10, created_at: '2026-03-17T10:00:00Z' },
          { total_earned: 200, commission_amount: 60, tip_amount: 20, created_at: '2026-03-17T14:00:00Z' },
        ],
        error: null,
      });
      renderEarningsTab();
      await waitFor(() => {
        // Gross = 100 + 200 = 300
        expect(screen.getByText('$300')).toBeInTheDocument();
        // Fees = 30 + 60 = 90
        expect(screen.getByText('-$90')).toBeInTheDocument();
        // Net = 300 - 90 = 210
        expect(screen.getByText('$210')).toBeInTheDocument();
        // Tips = 10 + 20 = 30
        expect(screen.getByText('$30')).toBeInTheDocument();
      });
    });

    it('shows "No earnings data" when data is empty', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });
    });

    it('renders bar chart when daily data exists', async () => {
      mockOrder.mockResolvedValue({
        data: [
          { total_earned: 150, commission_amount: 45, tip_amount: 15, created_at: '2026-03-17T10:00:00Z' },
        ],
        error: null,
      });
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    it('logs error when query fails', async () => {
      const { logger } = await import('@/lib/logger');
      mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      renderEarningsTab();
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to fetch earnings', expect.objectContaining({ message: 'DB error' }));
      });
    });
  });

  describe('Range toggle', () => {
    it('defaults to "This Week"', () => {
      renderEarningsTab();
      const thisWeekBtn = screen.getByText('This Week');
      expect(thisWeekBtn.className).toContain('bg-emerald-500');
    });

    it('switches active range on click', async () => {
      renderEarningsTab();
      const thisMonthBtn = screen.getByText('This Month');
      fireEvent.click(thisMonthBtn);

      await waitFor(() => {
        expect(thisMonthBtn.className).toContain('bg-emerald-500');
        expect(screen.getByText('This Week').className).not.toContain('bg-emerald-500');
      });
    });

    it('re-fetches data when range changes', async () => {
      renderEarningsTab();
      await waitFor(() => {
        expect(mockOrder).toHaveBeenCalled();
      });

      const callCountBefore = mockOrder.mock.calls.length;
      fireEvent.click(screen.getByText('This Month'));

      await waitFor(() => {
        expect(mockOrder.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe('Commission rate editing', () => {
    it('shows adjust rate link', async () => {
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByText('Adjust rate')).toBeInTheDocument();
      });
    });

    it('opens slider when "Adjust rate" is clicked', async () => {
      renderEarningsTab();
      fireEvent.click(screen.getByText('Adjust rate'));

      await waitFor(() => {
        expect(screen.getByTestId('slider')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('cancel restores original rate and hides slider', async () => {
      renderEarningsTab();
      fireEvent.click(screen.getByText('Adjust rate'));

      await waitFor(() => {
        expect(screen.getByTestId('slider')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('slider')).not.toBeInTheDocument();
        expect(screen.getByText('25%')).toBeInTheDocument();
      });
    });

    it('uses driver commission_rate as default', () => {
      renderEarningsTab({ commission_rate: 35 });
      expect(screen.getByText('35%')).toBeInTheDocument();
    });

    it('falls back to 30% when commission_rate is null', () => {
      renderEarningsTab({ commission_rate: null });
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('saves commission rate on Save click', async () => {
      renderEarningsTab();
      fireEvent.click(screen.getByText('Adjust rate'));

      await waitFor(() => {
        expect(screen.getByTestId('slider')).toBeInTheDocument();
      });

      const slider = screen.getByTestId('slider');
      fireEvent.change(slider, { target: { value: '40' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ commission_rate: 40 });
        expect(mockCourierEq1).toHaveBeenCalledWith('id', 'driver-123');
        expect(mockCourierEq2).toHaveBeenCalledWith('tenant_id', TENANT_ID);
      });
    });

    it('shows success toast after saving commission', async () => {
      const { toast } = await import('sonner');
      renderEarningsTab();
      fireEvent.click(screen.getByText('Adjust rate'));

      await waitFor(() => {
        expect(screen.getByTestId('slider')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Commission rate updated');
      });
    });
  });

  describe('Export', () => {
    it('calls exportToCSV when data exists and Generate Report is clicked', async () => {
      mockOrder.mockResolvedValue({
        data: [
          { total_earned: 100, commission_amount: 30, tip_amount: 10, created_at: '2026-03-17T10:00:00Z' },
        ],
        error: null,
      });
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText('$100')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Generate Report'));
      expect(exportToCSV).toHaveBeenCalled();
    });

    it('still exports when earnings are zero', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Generate Report'));
      // When query resolves with empty rows, earnings object exists (all zeros),
      // so export still produces a valid report with zero values.
      expect(exportToCSV).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles null tip_amount gracefully', async () => {
      mockOrder.mockResolvedValue({
        data: [
          { total_earned: 100, commission_amount: 30, tip_amount: null, created_at: '2026-03-17T10:00:00Z' },
        ],
        error: null,
      });
      renderEarningsTab();
      await waitFor(() => {
        expect(screen.getByText('$0')).toBeInTheDocument(); // tips = 0
      });
    });

    it('handles rows without created_at for daily grouping', async () => {
      mockOrder.mockResolvedValue({
        data: [
          { total_earned: 100, commission_amount: 30, tip_amount: 10, created_at: null },
        ],
        error: null,
      });
      renderEarningsTab();
      await waitFor(() => {
        // Gross still computed, but no daily data entry for null date
        expect(screen.getByText('$100')).toBeInTheDocument();
      });
    });
  });
});
