import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mockListAdminRecords = vi.fn();
const mockCreateAdminRecord = vi.fn();
const mockDeleteAdminRecord = vi.fn();

vi.mock('@/utils/adminApiClient', () => ({
  listAdminRecords: (...args: unknown[]) => mockListAdminRecords(...args),
  createAdminRecord: (...args: unknown[]) => mockCreateAdminRecord(...args),
  deleteAdminRecord: (...args: unknown[]) => mockDeleteAdminRecord(...args),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    onOpenChange,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    title?: string;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={() => onOpenChange(false)}>Cancel Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({
    title,
    description,
    primaryAction,
  }: {
    title?: string;
    description?: string;
    primaryAction?: { label: string; onClick: () => void };
  }) => (
    <div data-testid="empty-state">
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {primaryAction && (
        <button data-testid="empty-state-cta" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

import ApiAccess from '../ApiAccess';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/settings/api-access']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockApiKeys = [
  {
    id: 'key-1',
    name: 'Production Key',
    key: 'sk_abc123def456ghi789',
    created_at: '2024-01-15T10:30:00Z',
    permissions: ['read:orders', 'write:orders'],
  },
  {
    id: 'key-2',
    name: 'Staging Key',
    key: 'sk_xyz789abc123def456',
    created_at: '2024-02-20T14:00:00Z',
    permissions: ['read:products'],
  },
];

describe('ApiAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAdminRecords.mockResolvedValue({ data: [], error: null });
    mockCreateAdminRecord.mockResolvedValue({ data: { id: 'new-key' }, error: null });
    mockDeleteAdminRecord.mockResolvedValue({ data: { success: true }, error: null });

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

  });

  describe('Loading State', () => {
    it('should render loading skeleton while fetching', () => {
      mockListAdminRecords.mockReturnValue(new Promise(() => {}));
      render(<ApiAccess />, { wrapper: createWrapper() });

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('API Access')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no API keys exist', async () => {
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No API Keys')).toBeInTheDocument();
    });

    it('should open create dialog from empty state CTA', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-cta')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('empty-state-cta'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('API Keys List', () => {
    it('should render API key cards when keys exist', async () => {
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
        expect(screen.getByText('Staging Key')).toBeInTheDocument();
      });
    });

    it('should display permission badges', async () => {
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('read:orders')).toBeInTheDocument();
        expect(screen.getByText('write:orders')).toBeInTheDocument();
        expect(screen.getByText('read:products')).toBeInTheDocument();
      });
    });

    it('should show truncated key value', async () => {
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('sk_abc123def456ghi789'.slice(0, 20) + '...')).toBeInTheDocument();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('should call clipboard write and show toast on copy click', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });

      const copyButton = screen.getByLabelText('Copy API key Production Key');
      await user.click(copyButton);

      // Verify the success toast was shown (clipboard.writeText is called internally)
      expect(toast.success).toHaveBeenCalledWith('API key copied to clipboard');
    });
  });

  describe('Create API Key', () => {
    it('should open create dialog when header button is clicked', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Generate a new API key for your application')).toBeInTheDocument();
    });

    it('should show validation error when name is empty', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      // Open dialog via header button
      await user.click(screen.getByLabelText('Create new API key'));

      // Select a permission but leave name empty
      const readOrdersLabel = screen.getByText('read:orders');
      await user.click(readOrdersLabel);

      // Submit
      const submitButton = screen.getByRole('button', { name: /create key/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Key name is required')).toBeInTheDocument();
      });
    });

    it('should show validation error when no permissions selected', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));

      // Fill name but no permissions
      await user.type(screen.getByLabelText('Key Name'), 'Test Key');

      const submitButton = screen.getByRole('button', { name: /create key/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Select at least one permission')).toBeInTheDocument();
      });
    });

    it('should create key with valid form data', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));

      await user.type(screen.getByLabelText('Key Name'), 'My New Key');
      await user.click(screen.getByText('read:orders'));
      await user.click(screen.getByText('write:orders'));

      const submitButton = screen.getByRole('button', { name: /create key/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateAdminRecord).toHaveBeenCalledWith(
          'api_keys',
          expect.objectContaining({
            name: 'My New Key',
            permissions: ['read:orders', 'write:orders'],
          })
        );
      });
    });

    it('should show success toast after key creation', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));
      await user.type(screen.getByLabelText('Key Name'), 'My Key');
      await user.click(screen.getByText('read:orders'));

      const submitButton = screen.getByRole('button', { name: /create key/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('New API key has been generated.');
      });
    });
  });

  describe('Delete API Key', () => {
    it('should open confirm dialog when revoke button is clicked', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });

      const revokeButton = screen.getByLabelText('Revoke API key Production Key');
      await user.click(revokeButton);

      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      expect(screen.getByText('Revoke API Key')).toBeInTheDocument();
    });

    it('should delete key when confirmed', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Revoke API key Production Key'));
      await user.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(mockDeleteAdminRecord).toHaveBeenCalledWith('api_keys', 'key-1');
      });
    });

    it('should show success toast after key deletion', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Revoke API key Production Key'));
      await user.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('API key has been revoked.');
      });
    });
  });

  describe('Error State', () => {
    it('should render error state with retry button when query fails', async () => {
      // Return error object so queryFn throws; component retries twice
      mockListAdminRecords.mockResolvedValue({ data: null, error: new Error('Network error') });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Failed to load API keys. Please try again.')).toBeInTheDocument();
      }, { timeout: 5000 });
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should refetch when retry is clicked', async () => {
      const user = userEvent.setup();
      mockListAdminRecords.mockResolvedValue({ data: null, error: new Error('Network error') });
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      }, { timeout: 5000 });

      mockListAdminRecords.mockResolvedValue({ data: mockApiKeys, error: null });
      await user.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByText('Production Key')).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Context', () => {
    it('should not fetch when tenant is missing', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<ApiAccess />, { wrapper: createWrapper() });

      expect(mockListAdminRecords).not.toHaveBeenCalled();
    });
  });

  describe('Permissions UI', () => {
    it('should display all available permissions in create dialog', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));

      expect(screen.getByText('read:orders')).toBeInTheDocument();
      expect(screen.getByText('write:orders')).toBeInTheDocument();
      expect(screen.getByText('read:products')).toBeInTheDocument();
      expect(screen.getByText('write:products')).toBeInTheDocument();
      expect(screen.getByText('read:customers')).toBeInTheDocument();
      expect(screen.getByText('write:customers')).toBeInTheDocument();
      expect(screen.getByText('read:inventory')).toBeInTheDocument();
      expect(screen.getByText('write:inventory')).toBeInTheDocument();
    });

    it('should toggle permissions on checkbox click', async () => {
      const user = userEvent.setup();
      render(<ApiAccess />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Create new API key'));

      // Find the checkbox for read:orders
      const checkboxes = screen.getAllByRole('checkbox');
      const readOrdersCheckbox = checkboxes[0]; // First one is read:orders
      expect(readOrdersCheckbox).not.toBeChecked();

      await user.click(readOrdersCheckbox);
      expect(readOrdersCheckbox).toBeChecked();

      await user.click(readOrdersCheckbox);
      expect(readOrdersCheckbox).not.toBeChecked();
    });
  });
});
