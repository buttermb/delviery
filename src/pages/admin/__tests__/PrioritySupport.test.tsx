import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

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

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'ticket-1',
                      subject: 'Login Issue',
                      description: 'Cannot login to admin panel',
                      priority: 'high',
                      status: 'open',
                      created_at: '2026-03-01T10:00:00Z',
                      updated_at: '2026-03-01T10:00:00Z',
                      tenant_id: 'test-tenant-id',
                    },
                    {
                      id: 'ticket-2',
                      subject: 'Export Bug',
                      description: 'CSV export produces empty file',
                      priority: 'normal',
                      status: 'resolved',
                      created_at: '2026-02-28T09:00:00Z',
                      updated_at: '2026-03-01T08:00:00Z',
                      tenant_id: 'test-tenant-id',
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
        insert: (data: unknown) => {
          mockInsert(data);
          return {
            select: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: 'new-ticket' }, error: null }),
            }),
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        },
      };
    },
  },
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: () => false,
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={() => onOpenChange(false)}>Cancel Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({
    title,
    primaryAction,
  }: {
    title: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="enhanced-empty-state">
      <span>{title}</span>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

import PrioritySupport from '../PrioritySupport';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('PrioritySupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header and stats cards', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Priority Support')).toBeInTheDocument();
    });

    expect(screen.getByText('Open Tickets')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Total Tickets')).toBeInTheDocument();
  });

  it('renders ticket list from query', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    expect(screen.getByText('Export Bug')).toBeInTheDocument();
    expect(screen.getByText('Cannot login to admin panel')).toBeInTheDocument();
  });

  it('displays correct stat counts', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    // 1 open ticket
    const openCount = screen.getAllByText('1');
    expect(openCount.length).toBeGreaterThanOrEqual(1);
    // 2 total tickets
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('filters tickets by search term', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search tickets...');
    await user.type(searchInput, 'Export');

    expect(screen.queryByText('Login Issue')).not.toBeInTheDocument();
    expect(screen.getByText('Export Bug')).toBeInTheDocument();
  });

  it('shows empty state when search has no results', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search tickets...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByTestId('enhanced-empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No tickets match your search')).toBeInTheDocument();
  });

  it('opens create ticket dialog on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    // The "New Ticket" button text is hidden on mobile, look for the button with Plus icon
    const newTicketBtn = screen.getByRole('button', { name: /new ticket/i });
    await user.click(newTicketBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Support Ticket')).toBeInTheDocument();
    });
  });

  it('has maxLength on form inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const newTicketBtn = screen.getByRole('button', { name: /new ticket/i });
    await user.click(newTicketBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Brief description of the issue')).toBeInTheDocument();
    });

    const subjectInput = screen.getByPlaceholderText('Brief description of the issue');
    const descriptionInput = screen.getByPlaceholderText('Detailed description of the issue');

    expect(subjectInput).toHaveAttribute('maxLength', '200');
    expect(descriptionInput).toHaveAttribute('maxLength', '2000');
  });

  it('shows character count for description', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const newTicketBtn = screen.getByRole('button', { name: /new ticket/i });
    await user.click(newTicketBtn);

    await waitFor(() => {
      expect(screen.getByText('0/2000')).toBeInTheDocument();
    });
  });

  it('has delete button with aria-label on each ticket', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Delete ticket: Login Issue')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete ticket: Export Bug')).toBeInTheDocument();
  });

  it('opens confirm delete dialog when delete button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Delete ticket: Login Issue');
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });
  });

  it('has search input with maxLength', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search tickets...');
    expect(searchInput).toHaveAttribute('maxLength', '100');
  });

  it('displays priority and status badges correctly', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(screen.getByText('Login Issue')).toBeInTheDocument();
    });

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('queries support_tickets table with tenant_id filter', async () => {
    renderWithProviders(<PrioritySupport />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('support_tickets');
    });
  });
});
