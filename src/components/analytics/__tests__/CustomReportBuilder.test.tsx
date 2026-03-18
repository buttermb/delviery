/**
 * Tests for CustomReportBuilder analytics widget
 * Verifies rendering states: loading, empty, and with data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { CustomReportBuilder } from '../CustomReportBuilder';

// Mock Supabase client
const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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

// Mock useTenantAdminAuth
const mockTenant = { id: 'tenant-123', business_name: 'Test Shop' };
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    admin: { id: 'admin-1' },
  }),
}));

// Mock ReportBuilder (the dialog)
vi.mock('@/components/admin/reporting/ReportBuilder', () => ({
  ReportBuilder: ({ open }: { open: boolean }) =>
    open ? <div data-testid="report-builder-dialog">Report Builder</div> : null,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: (date: Date, fmt: string) => `${date.toISOString().split('T')[0]}`,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('CustomReportBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons while fetching', async () => {
    // Never resolve to keep loading state
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => new Promise(() => {})),
          })),
        })),
      })),
    });

    render(<CustomReportBuilder />, { wrapper: createWrapper() });

    expect(screen.getByText('Custom Report Builder')).toBeInTheDocument();
    expect(screen.getByText('New Report')).toBeInTheDocument();
  });

  it('renders empty state when no reports exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    });

    render(<CustomReportBuilder />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No reports yet. Create your first custom report.')).toBeInTheDocument();
    });
  });

  it('renders saved reports when data exists', async () => {
    const mockReports = [
      {
        id: 'report-1',
        name: 'Monthly Sales',
        description: 'Sales overview',
        report_type: 'sales',
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: 'report-2',
        name: 'Inventory Check',
        description: null,
        report_type: 'inventory',
        created_at: '2026-03-10T00:00:00Z',
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: mockReports, error: null })),
          })),
        })),
      })),
    });

    render(<CustomReportBuilder />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Monthly Sales')).toBeInTheDocument();
      expect(screen.getByText('Inventory Check')).toBeInTheDocument();
    });

    // Check badges
    expect(screen.getByText('sales')).toBeInTheDocument();
    expect(screen.getByText('inventory')).toBeInTheDocument();
  });

  it('handles database error gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({ data: null, error: { code: '42P01', message: 'table not found' } })
            ),
          })),
        })),
      })),
    });

    render(<CustomReportBuilder />, { wrapper: createWrapper() });

    // Should show empty state when table doesn't exist (42P01)
    await waitFor(() => {
      expect(screen.getByText('No reports yet. Create your first custom report.')).toBeInTheDocument();
    });
  });

  it('renders header with title and new report button', () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => new Promise(() => {})),
          })),
        })),
      })),
    });

    render(<CustomReportBuilder />, { wrapper: createWrapper() });

    expect(screen.getByText('Custom Report Builder')).toBeInTheDocument();
    expect(screen.getByText('Build and run custom data reports')).toBeInTheDocument();
    expect(screen.getByText('New Report')).toBeInTheDocument();
  });
});
