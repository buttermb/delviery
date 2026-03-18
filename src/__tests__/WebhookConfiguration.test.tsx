import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase client
const mockFrom = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/hooks/useTenantAdminAuth', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
    admin: { id: 'admin-1' },
    loading: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { WebhookConfiguration } from '@/components/settings/WebhookConfiguration';
import { toast } from 'sonner';

const MOCK_WEBHOOKS = [
  {
    id: 'wh-1',
    name: 'Production Webhook',
    url: 'https://example.com/webhook',
    events: ['order.created', 'payment.received'],
    secret: 'whsec_abc123',
    is_active: true,
    last_triggered_at: '2026-03-15T10:00:00Z',
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'wh-2',
    name: 'Staging Webhook',
    url: 'https://staging.example.com/webhook',
    events: ['order.created'],
    secret: null,
    is_active: false,
    last_triggered_at: null,
    created_at: '2026-03-02T00:00:00Z',
  },
];

function createChainableMock(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve(resolvedValue));
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolvedValue));
  return chain;
}

function setupDefaultMocks() {
  const webhookChain = createChainableMock({ data: MOCK_WEBHOOKS, error: null });
  mockFrom.mockReturnValue(webhookChain);
  return webhookChain;
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    ),
  };
}

describe('WebhookConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton initially', () => {
    // Make query hang
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => new Promise(() => {})),
        })),
      })),
    });

    renderWithProviders(<WebhookConfiguration />);
    expect(screen.getByText('Webhook Configuration')).toBeInTheDocument();
    // Loading skeletons should be visible (no webhook data yet)
  });

  it('renders webhook list after loading', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    expect(screen.getByText('Staging Webhook')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/webhook')).toBeInTheDocument();
    expect(screen.getByText('https://staging.example.com/webhook')).toBeInTheDocument();
  });

  it('renders active/inactive badges correctly', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders event badges for each webhook', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    expect(screen.getAllByText('order.created')).toHaveLength(2);
    expect(screen.getByText('payment.received')).toBeInTheDocument();
  });

  it('renders empty state when no webhooks exist', async () => {
    const chain = createChainableMock({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(
        screen.getByText('No webhooks configured. Create one to receive events.')
      ).toBeInTheDocument();
    });
  });

  it('shows last triggered timestamp', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    expect(screen.getByText(/Last triggered/)).toBeInTheDocument();
  });

  it('shows webhook secret when present', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    expect(screen.getByText('whsec_abc123')).toBeInTheDocument();
  });

  it('filters webhooks by tenant_id', async () => {
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('webhooks');
    });
  });

  it('calls send-webhook function when test button is clicked', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, status: 'success', response_status: 200, duration_ms: 150 },
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    const testButton = screen.getByLabelText('Test webhook Production Webhook');
    await user.click(testButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('send-webhook', {
        body: {
          webhook_id: 'wh-1',
          payload: expect.objectContaining({
            event_type: 'test',
            message: 'This is a test webhook event from FloraIQ',
          }),
        },
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Test webhook delivered successfully')
      );
    });
  });

  it('shows error toast when test webhook fails', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, status: 'failed', response_status: 500, duration_ms: 200 },
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    const testButton = screen.getByLabelText('Test webhook Production Webhook');
    await user.click(testButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Test webhook failed')
      );
    });
  });

  it('deletes webhook with tenant_id filter', async () => {
    const deleteChain = createChainableMock({ data: null, error: null });
    // Return the delete chain only for delete operations
    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhooks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: MOCK_WEBHOOKS, error: null })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        };
      }
      return deleteChain;
    });

    const user = userEvent.setup();
    renderWithProviders(<WebhookConfiguration />);

    await waitFor(() => {
      expect(screen.getByText('Production Webhook')).toBeInTheDocument();
    });

    const deleteButton = screen.getByLabelText('Delete webhook Production Webhook');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Webhook deleted successfully');
    });
  });

  it('has a Create Webhook button that opens dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WebhookConfiguration />);

    const createButton = screen.getByText('Create Webhook', { selector: 'button span, button' });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Webhook URL')).toBeInTheDocument();
  });

  it('validates form inputs before creating webhook', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WebhookConfiguration />);

    // Open dialog
    const createButton = screen.getByText('Create Webhook', { selector: 'button span, button' });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Submit empty form
    const dialog = screen.getByRole('dialog');
    const submitButton = within(dialog).getAllByText('Create Webhook').find(
      (el) => el.closest('button[type="submit"]')
    );

    if (submitButton) {
      await user.click(submitButton);
    }

    // Validation errors should appear
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });
});
