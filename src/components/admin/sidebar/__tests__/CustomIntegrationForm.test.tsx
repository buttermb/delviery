import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { CustomIntegrationForm } from '../CustomIntegrationForm';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase client
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null });
const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Mock tenant admin auth
const mockTenantId = 'tenant-123';
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: mockTenantId },
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CustomIntegrationForm', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnIntegrationAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: { id: 'new-id' }, error: null });
    // Re-chain mocks since clearAllMocks resets return values
    mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  const renderForm = () => {
    return render(
      <CustomIntegrationForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onIntegrationAdded={mockOnIntegrationAdded}
      />
    );
  };

  it('renders all form fields', () => {
    renderForm();

    expect(screen.getByPlaceholderText('My Custom API')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://api.example.com/webhook')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('What does this integration do?')).toBeInTheDocument();
    expect(screen.getByText('Add Integration')).toBeInTheDocument();
  });

  it('validates required fields before submit', async () => {
    const user = userEvent.setup();
    renderForm();

    const submitButton = screen.getByText('Add Integration');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Integration name is required')).toBeInTheDocument();
    });

    // Should NOT call supabase
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('submits form data to custom_integrations table', async () => {
    const user = userEvent.setup();
    renderForm();

    // Fill in form
    await user.type(screen.getByPlaceholderText('My Custom API'), 'Test Integration');
    await user.clear(screen.getByPlaceholderText('https://api.example.com/webhook'));
    await user.type(screen.getByPlaceholderText('https://api.example.com/webhook'), 'https://example.com/hook');

    // Submit
    const submitButton = screen.getByText('Add Integration');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('custom_integrations');
    });

    // Verify the insert payload
    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.tenant_id).toBe(mockTenantId);
    expect(insertCall.name).toBe('Test Integration');
    expect(insertCall.type).toBe('webhook');
    expect(insertCall.status).toBe('active');
    expect(insertCall.config.endpoint_url).toBe('https://example.com/hook');
    expect(insertCall.config.auth_type).toBe('none');
  });

  it('calls onIntegrationAdded on successful submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText('My Custom API'), 'Test');
    await user.clear(screen.getByPlaceholderText('https://api.example.com/webhook'));
    await user.type(screen.getByPlaceholderText('https://api.example.com/webhook'), 'https://example.com/api');

    await user.click(screen.getByText('Add Integration'));

    await waitFor(() => {
      expect(mockOnIntegrationAdded).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not call onIntegrationAdded on mutation failure', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed', code: '42501' },
    });

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText('My Custom API'), 'Fail Test');
    await user.clear(screen.getByPlaceholderText('https://api.example.com/webhook'));
    await user.type(screen.getByPlaceholderText('https://api.example.com/webhook'), 'https://example.com/fail');

    await user.click(screen.getByText('Add Integration'));

    // Wait for the mutation to settle
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('custom_integrations');
    });

    expect(mockOnIntegrationAdded).not.toHaveBeenCalled();
  });

  it('includes custom headers in config', async () => {
    const user = userEvent.setup();
    renderForm();

    // Fill required fields
    await user.type(screen.getByPlaceholderText('My Custom API'), 'Header Test');
    await user.clear(screen.getByPlaceholderText('https://api.example.com/webhook'));
    await user.type(screen.getByPlaceholderText('https://api.example.com/webhook'), 'https://example.com/h');

    // Fill first header row and wait for state to settle
    const headerNameInput = screen.getAllByPlaceholderText('Header name')[0];
    const headerValueInput = screen.getAllByPlaceholderText('Header value')[0];
    await user.type(headerNameInput, 'X-Custom');
    await user.type(headerValueInput, 'my-value');

    // Verify header values are in the inputs before submitting
    await waitFor(() => {
      expect(headerNameInput).toHaveValue('X-Custom');
      expect(headerValueInput).toHaveValue('my-value');
    });

    await user.click(screen.getByText('Add Integration'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('custom_integrations');
    });

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.config.headers).toEqual({ 'X-Custom': 'my-value' });
  });

  it('adds and removes header rows', async () => {
    const user = userEvent.setup();
    renderForm();

    // Initially one header row
    expect(screen.getAllByPlaceholderText('Header name')).toHaveLength(1);

    // Add a header row
    await user.click(screen.getByText('Add Header'));
    expect(screen.getAllByPlaceholderText('Header name')).toHaveLength(2);

    // Remove second header row
    const removeButtons = screen.getAllByLabelText('Remove header');
    await user.click(removeButtons[1]);
    expect(screen.getAllByPlaceholderText('Header name')).toHaveLength(1);
  });

  it('excludes empty headers from config', async () => {
    const user = userEvent.setup();
    renderForm();

    // Fill required fields only (leave header empty)
    await user.type(screen.getByPlaceholderText('My Custom API'), 'No Headers');
    await user.clear(screen.getByPlaceholderText('https://api.example.com/webhook'));
    await user.type(screen.getByPlaceholderText('https://api.example.com/webhook'), 'https://example.com/x');

    await user.click(screen.getByText('Add Integration'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('custom_integrations');
    });

    const insertCall = mockInsert.mock.calls[0][0];
    expect(insertCall.config.headers).toEqual({});
  });
});
