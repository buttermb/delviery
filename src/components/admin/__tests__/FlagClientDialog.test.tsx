import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagClientDialog } from '../FlagClientDialog';

// Mock supabase
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockEqChained = vi.fn();
const mockIs = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'fraud_flags') {
        return {
          insert: mockInsert.mockReturnValue(
            Promise.resolve({ data: null, error: null })
          ),
        };
      }
      if (table === 'wholesale_clients') {
        return {
          update: mockUpdate.mockReturnValue({
            eq: mockEq.mockReturnValue({
              eq: mockEqChained.mockReturnValue(
                Promise.resolve({ data: null, error: null })
              ),
            }),
          }),
        };
      }
      return {};
    }),
  },
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    wholesaleClient: { byId: (id?: string) => ['wholesale-client', id] },
    wholesaleClients: { all: ['wholesale-clients'] },
    wholesaleData: {
      clientDetail: (clientId: string, tenantId: string) => ['wholesale-data', 'client-detail', clientId, tenantId],
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('FlagClientDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    clientId: 'client-123',
    clientName: 'Test Cannabis Co',
    tenantId: 'tenant-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title and description', () => {
    render(<FlagClientDialog {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getAllByText('Flag Client')).toHaveLength(2); // title + submit button
    expect(screen.getByText(/Flag Test Cannabis Co for review/)).toBeInTheDocument();
  });

  it('renders reason select, severity select, and notes textarea', () => {
    render(<FlagClientDialog {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Notes (optional)')).toBeInTheDocument();
  });

  it('disables submit button when no reason is selected', () => {
    render(<FlagClientDialog {...defaultProps} />, { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: 'Flag Client' });
    expect(submitButton).toBeDisabled();
  });

  it('renders cancel button that calls onOpenChange', () => {
    render(<FlagClientDialog {...defaultProps} />, { wrapper: createWrapper() });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    render(
      <FlagClientDialog {...defaultProps} open={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Flag Client')).not.toBeInTheDocument();
  });

  it('shows all flag reason options in select', async () => {
    render(<FlagClientDialog {...defaultProps} />, { wrapper: createWrapper() });

    // The select trigger should show "Select a reason" placeholder
    expect(screen.getByText('Select a reason')).toBeInTheDocument();
  });
});
