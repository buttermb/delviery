import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import CustomDomain from '../CustomDomain';

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
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
  }),
}));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn(() => false),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm, itemName }: {
    open: boolean;
    onConfirm: () => void;
    itemName?: string;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

function setupMockQuery(data: unknown[] | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

const mockDomains = [
  {
    id: 'dom-1',
    domain: 'shop.example.com',
    status: 'active',
    ssl_status: 'active',
    verification_record: 'floraiq-verify-abc123',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'dom-2',
    domain: 'store.test.com',
    status: 'pending',
    ssl_status: null,
    verification_record: 'floraiq-verify-def456',
    created_at: '2026-02-01T00:00:00Z',
  },
];

describe('CustomDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially', () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(<CustomDomain />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Custom Domain')).toBeInTheDocument();
  });

  it('renders empty state when no domains exist', async () => {
    setupMockQuery([]);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/No custom domains configured/)).toBeInTheDocument();
    });
  });

  it('renders domain list with status badges', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Domain names appear in both domain list and DNS section
      expect(screen.getAllByText('shop.example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('store.test.com').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows verify button for pending domains only', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Verify DNS for store.test.com/ })).toBeInTheDocument();
    });

    // Active domain should NOT have a verify button
    expect(screen.queryByRole('button', { name: /Verify DNS for shop.example.com/ })).not.toBeInTheDocument();
  });

  it('validates domain format with Zod', async () => {
    setupMockQuery([]);
    const user = userEvent.setup();

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Domain Name')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Domain Name');
    const submitBtn = screen.getByRole('button', { name: /Add custom domain/ });

    await user.type(input, 'not-a-domain');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid domain/)).toBeInTheDocument();
    });
  });

  it('accepts valid domain names', async () => {
    const chain = setupMockQuery([]);
    const user = userEvent.setup();

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Domain Name')).toBeInTheDocument();
    });

    const input = screen.getByLabelText('Domain Name');
    const submitBtn = screen.getByRole('button', { name: /Add custom domain/ });

    await user.type(input, 'shop.example.com');
    await user.click(submitBtn);

    // Should not show validation error
    expect(screen.queryByText(/Enter a valid domain/)).not.toBeInTheDocument();
    // Should have called supabase insert
    expect(chain.insert).toHaveBeenCalled();
  });

  it('shows DNS configuration with CNAME instructions', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('DNS Configuration')).toBeInTheDocument();
    });

    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    // CNAME appears in both Type: CNAME and Name line, so use getAllByText
    expect(screen.getAllByText(/CNAME/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows verification records and DNS step 2 for configured domains', async () => {
    setupMockQuery(mockDomains);

    const { container } = render(<CustomDomain />, { wrapper: createWrapper() });

    // Wait for domain list to render (proves data loaded)
    await waitFor(() => {
      expect(screen.getByText('Configured Domains')).toBeInTheDocument();
    });

    // Verification records should appear in the DNS section
    await waitFor(() => {
      // Check that verification text is present in rendered HTML
      const html = container.innerHTML;
      expect(html).toContain('floraiq-verify-abc123');
      expect(html).toContain('floraiq-verify-def456');
    });
  });

  it('shows delete button for each domain', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove domain shop.example.com/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove domain store.test.com/ })).toBeInTheDocument();
    });
  });

  it('opens confirm dialog on delete click', async () => {
    setupMockQuery(mockDomains);
    const user = userEvent.setup();

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove domain shop.example.com/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Remove domain shop.example.com/ }));

    expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete shop.example.com/)).toBeInTheDocument();
  });

  it('renders SSL status for active domains', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/SSL active/)).toBeInTheDocument();
    });
  });

  it('shows error state with retry button', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied', code: '42501' },
      }),
    });

    // Create a query client with no retries so error state shows immediately
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function ErrorWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>{children}</BrowserRouter>
        </QueryClientProvider>
      );
    }

    render(<CustomDomain />, { wrapper: ErrorWrapper });

    await waitFor(
      () => {
        expect(screen.getByText(/Failed to load domains/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByRole('button', { name: /Retry loading domains/ })).toBeInTheDocument();
  });

  it('shows copy buttons for DNS records', async () => {
    setupMockQuery(mockDomains);

    render(<CustomDomain />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy CNAME value/ })).toBeInTheDocument();
    });

    // Each domain with verification_record should have a copy button
    const copyButtons = screen.getAllByRole('button', { name: /Copy verification record/ });
    expect(copyButtons.length).toBe(2);
  });
});
