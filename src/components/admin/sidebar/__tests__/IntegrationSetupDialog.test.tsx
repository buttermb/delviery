/**
 * IntegrationSetupDialog Tests
 * Tests for the integration setup dialog that wires backend secret storage
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntegrationSetupDialog } from '../IntegrationSetupDialog';

// Mock supabase client
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

describe('IntegrationSetupDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    integrationId: 'stripe',
    integrationName: 'Stripe',
    onSetupComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with integration name in title', () => {
    render(<IntegrationSetupDialog {...defaultProps} />);
    expect(screen.getByText('Configure Stripe')).toBeInTheDocument();
  });

  it('renders fields for Stripe integration', () => {
    render(<IntegrationSetupDialog {...defaultProps} />);
    expect(screen.getByLabelText('Your Stripe Secret Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Stripe Publishable Key')).toBeInTheDocument();
  });

  it('renders fields for Twilio integration', () => {
    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );
    expect(screen.getByLabelText('Account SID')).toBeInTheDocument();
    expect(screen.getByLabelText('Auth Token')).toBeInTheDocument();
  });

  it('renders fields for SendGrid integration', () => {
    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="sendgrid"
        integrationName="SendGrid"
      />,
    );
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
  });

  it('renders fields for Mapbox integration', () => {
    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="mapbox"
        integrationName="Mapbox"
      />,
    );
    expect(screen.getByLabelText('Public Access Token')).toBeInTheDocument();
  });

  it('returns null for unknown integration', () => {
    const { container } = render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="unknown"
        integrationName="Unknown"
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('calls save-integration-secrets edge function on submit', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Account SID'), 'AC1234567890');
    await user.type(screen.getByLabelText('Auth Token'), 'my-auth-token');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save-integration-secrets', {
        body: {
          integration_id: 'twilio',
          credentials: {
            TWILIO_ACCOUNT_SID: 'AC1234567890',
            TWILIO_AUTH_TOKEN: 'my-auth-token',
          },
        },
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Twilio configured successfully');
    });
    expect(defaultProps.onSetupComplete).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls save-integration-secrets for SendGrid on submit', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="sendgrid"
        integrationName="SendGrid"
      />,
    );

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('API Key'), 'SG.test-key');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save-integration-secrets', {
        body: {
          integration_id: 'sendgrid',
          credentials: {
            SENDGRID_API_KEY: 'SG.test-key',
          },
        },
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('SendGrid configured successfully');
    });
  });

  it('calls save-integration-secrets for Stripe on submit', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    render(<IntegrationSetupDialog {...defaultProps} />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Your Stripe Secret Key'), 'sk_test_abc123');
    await user.type(screen.getByLabelText('Your Stripe Publishable Key'), 'pk_test_abc123');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save-integration-secrets', {
        body: {
          integration_id: 'stripe',
          credentials: {
            TENANT_STRIPE_SECRET_KEY: 'sk_test_abc123',
            TENANT_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc123',
          },
        },
      });
    });
  });

  it('shows error toast when edge function returns error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Unauthorized' },
    });

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="sendgrid"
        integrationName="SendGrid"
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('API Key'), 'SG.bad-key');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(defaultProps.onSetupComplete).not.toHaveBeenCalled();
  });

  it('shows error toast when data contains error field', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Insufficient permissions — admin or owner role required' },
      error: null,
    });

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Account SID'), 'AC123');
    await user.type(screen.getByLabelText('Auth Token'), 'token');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(defaultProps.onSetupComplete).not.toHaveBeenCalled();
  });

  it('shows Test Connection button for testable integrations', () => {
    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('does not show Test Connection button for non-testable integrations', () => {
    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="mapbox"
        integrationName="Mapbox"
      />,
    );
    expect(screen.queryByText('Test Connection')).not.toBeInTheDocument();
  });

  it('calls check-twilio-config on test connection', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { configured: true }, error: null });

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Test Connection'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('check-twilio-config');
    });

    await waitFor(() => {
      expect(screen.getByText('Connection successful! Integration is working correctly.')).toBeInTheDocument();
    });
  });

  it('shows Stripe test mode badge when using test key', async () => {
    render(<IntegrationSetupDialog {...defaultProps} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Your Stripe Secret Key'), 'sk_test_12345');

    expect(screen.getByText('Test Mode Active')).toBeInTheDocument();
    expect(screen.getByText('No real charges will be made')).toBeInTheDocument();
  });

  it('shows docs link when docsUrl is present', () => {
    render(<IntegrationSetupDialog {...defaultProps} />);
    expect(screen.getByText('View Documentation')).toBeInTheDocument();
  });

  it('disables buttons while submitting', async () => {
    // Make the invoke hang so we can check disabled state
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(
      <IntegrationSetupDialog
        {...defaultProps}
        integrationId="twilio"
        integrationName="Twilio"
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Account SID'), 'AC123');
    await user.type(screen.getByLabelText('Auth Token'), 'token');
    await user.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(screen.getByText('Save Configuration').closest('button')).toBeDisabled();
      expect(screen.getByText('Test Connection').closest('button')).toBeDisabled();
    });
  });
});
