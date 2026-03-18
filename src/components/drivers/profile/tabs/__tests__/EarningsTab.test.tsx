import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EarningsTab } from '../EarningsTab';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...a: unknown[]) => {
          mockSelect(...a);
          return {
            eq: (...a2: unknown[]) => {
              mockEq(...a2);
              return {
                gte: (...a3: unknown[]) => {
                  mockGte(...a3);
                  return {
                    lte: (...a4: unknown[]) => {
                      mockLte(...a4);
                      return {
                        order: (...a5: unknown[]) => {
                          mockOrder(...a5);
                          return { data: [], error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        update: (...a: unknown[]) => {
          mockUpdate(...a);
          return {
            eq: () => ({
              eq: () => ({ error: null }),
            }),
          };
        },
      };
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: {
      byTenant: (tenantId?: string) => ['couriers', tenantId],
    },
  },
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  exportToCSV: vi.fn(),
  generateExportFilename: vi.fn(() => 'test-file.csv'),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    size?: string;
    variant?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
  }: {
    value: number[];
    onValueChange: (v: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
  }) => (
    <input
      data-testid="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  ),
}));

vi.mock('@/components/ui/lazy-recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-length={data.length}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
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

const baseDriver: DriverProfile = {
  id: 'driver-1',
  full_name: 'Test Driver',
  phone: '555-1234',
  email: 'test@example.com',
  avatar_url: null,
  status: 'active',
  vehicle_type: 'car',
  vehicle_plate: 'ABC-123',
  license_number: 'DL123',
  commission_rate: 25,
  current_lat: null,
  current_lng: null,
  rating: 4.5,
  total_deliveries: 50,
  created_at: '2025-01-01',
  tenant_id: 'tenant-1',
} as DriverProfile;

function renderEarningsTab(
  overrides?: Partial<{ driver: DriverProfile; tenantId: string }>,
) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <EarningsTab
        driver={overrides?.driver ?? baseDriver}
        tenantId={overrides?.tenantId ?? 'tenant-1'}
      />
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

  describe('Range Toggle', () => {
    it('renders all three range buttons', () => {
      renderEarningsTab();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Last Month')).toBeInTheDocument();
    });

    it('defaults to "This Week" as active', () => {
      renderEarningsTab();
      const btn = screen.getByText('This Week');
      expect(btn.className).toContain('bg-emerald-500');
    });

    it('switches active range on click', () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('This Month'));
      expect(screen.getByText('This Month').className).toContain('bg-emerald-500');
      expect(screen.getByText('This Week').className).not.toContain('bg-emerald-500');
    });

    it('fetches earnings data for the selected range', async () => {
      renderEarningsTab();

      // Initial fetch for "This Week"
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('courier_earnings');
      });

      // The date range filter should use .gte and .lte
      expect(mockGte).toHaveBeenCalled();
      expect(mockLte).toHaveBeenCalled();
    });

    it('re-fetches data when range changes', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalled();
      });

      const callCountBefore = mockFrom.mock.calls.length;

      fireEvent.click(screen.getByText('This Month'));

      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });

    it('filters by courier_id', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(mockEq).toHaveBeenCalledWith('courier_id', 'driver-1');
      });
    });
  });

  describe('Stat Cards', () => {
    it('renders four stat cards', () => {
      renderEarningsTab();
      expect(screen.getByText('Gross')).toBeInTheDocument();
      expect(screen.getByText('Fees')).toBeInTheDocument();
      expect(screen.getByText('Net')).toBeInTheDocument();
      expect(screen.getByText('Tips')).toBeInTheDocument();
    });

    it('shows $0 values when no data', async () => {
      renderEarningsTab();

      await waitFor(() => {
        // Gross, Net, and Tips all show $0; Fees shows -$0
        const zeroElements = screen.getAllByText('$0');
        expect(zeroElements.length).toBe(3);
        expect(screen.getByText('-$0')).toBeInTheDocument();
      });
    });
  });

  describe('Chart', () => {
    it('shows "No earnings data" when daily array is empty', async () => {
      renderEarningsTab();

      await waitFor(() => {
        expect(screen.getByText('No earnings data')).toBeInTheDocument();
      });
    });

    it('shows chart subtitle with current range', () => {
      renderEarningsTab();
      expect(screen.getByText(/Daily Earnings — This Week/)).toBeInTheDocument();
    });

    it('updates chart subtitle when range changes', () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('This Month'));
      expect(screen.getByText(/Daily Earnings — This Month/)).toBeInTheDocument();
    });
  });

  describe('Commission Rate', () => {
    it('displays current commission rate', () => {
      renderEarningsTab();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('defaults to 30% when commission_rate is null', () => {
      renderEarningsTab({
        driver: { ...baseDriver, commission_rate: null },
      });
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('opens edit mode on "Adjust rate" click', () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('Adjust rate'));
      expect(screen.getByTestId('slider')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('closes edit mode on cancel', () => {
      renderEarningsTab();

      fireEvent.click(screen.getByText('Adjust rate'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByTestId('slider')).not.toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('renders export section', () => {
      renderEarningsTab();
      expect(screen.getByText('Export Earnings Report')).toBeInTheDocument();
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
    });
  });
});
