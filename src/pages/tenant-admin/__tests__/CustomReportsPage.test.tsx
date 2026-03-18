/**
 * Tests for CustomReportsPage
 * Verifies tenant_id filtering, report listing, and delete confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as React from 'react';
import CustomReportsPage from '../CustomReportsPage';

// Mock Supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  delete: mockDelete,
  insert: mockInsert,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })
      ),
    },
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

// Mock tenant auth
const mockTenantId = 'tenant-abc-123';
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: mockTenantId, business_name: 'Test Business' },
    admin: { id: 'admin-1' },
  }),
}));

// Mock humanizeError
vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => (e instanceof Error ? e.message : 'Unknown error'),
}));

// Mock ReportBuilder
vi.mock('@/components/reports/ReportBuilder', () => ({
  ReportBuilder: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="report-builder">
      <button onClick={onClose}>Close Builder</button>
    </div>
  ),
}));

// Mock ConfirmDeleteDialog
vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
    isLoading,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    itemName?: string;
    itemType?: string;
    isLoading?: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm} disabled={isLoading}>
          Confirm Delete
        </button>
      </div>
    ) : null,
}));

// Mock EnhancedLoadingState
vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message?: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

const mockReports = [
  {
    id: 'report-1',
    name: 'Weekly Sales',
    report_type: 'sales',
    description: 'Weekly sales overview',
    is_active: true,
    selected_fields: ['total_amount', 'order_number'],
    schedule: 'weekly',
    email_recipients: ['admin@test.com'],
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'report-2',
    name: 'Inventory Snapshot',
    report_type: 'inventory',
    description: null,
    is_active: false,
    selected_fields: ['product_name', 'quantity_lbs'],
    schedule: 'none',
    email_recipients: null,
    created_at: '2026-03-10T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function setupMockChain(data: unknown[] | null, error: unknown | null = null) {
  mockOrder.mockReturnValue(Promise.resolve({ data, error }));
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({
    select: mockSelect,
    delete: mockDelete,
    insert: mockInsert,
  });
}

describe('CustomReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockChain(mockReports);
  });

  it('renders loading state initially', () => {
    // Use a never-resolving promise for loading state
    mockOrder.mockReturnValue(new Promise(() => {}));
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    render(<CustomReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders reports when data is loaded', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Weekly Sales')).toBeInTheDocument();
      expect(screen.getByText('Inventory Snapshot')).toBeInTheDocument();
    });
  });

  it('filters by tenant_id in query', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('custom_reports');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', mockTenantId);
    });
  });

  it('shows report metadata: schedule and recipients', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Weekly Sales')).toBeInTheDocument();
    });

    // Check schedule badge
    expect(screen.getByText('weekly')).toBeInTheDocument();
    // Check recipients count
    expect(screen.getByText(/1 recipient/)).toBeInTheDocument();
  });

  it('shows Active badge for active reports', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('renders empty state when no reports exist', async () => {
    setupMockChain([]);

    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No Custom Reports Yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first custom report to get started')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation dialog when delete button clicked', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Weekly Sales')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText(/Delete report/);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Weekly Sales?')).toBeInTheDocument();
    });
  });

  it('has Run and Delete buttons for each report', async () => {
    render(<CustomReportsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run');
      expect(runButtons.length).toBe(2);

      const deleteButtons = screen.getAllByLabelText(/Delete report/);
      expect(deleteButtons.length).toBe(2);
    });
  });
});
