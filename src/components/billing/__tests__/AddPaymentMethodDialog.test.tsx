import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPaymentMethodDialog } from '../AddPaymentMethodDialog';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tenantId?: string;
  onSuccess?: () => void;
}

const renderDialog = (props: DialogProps = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    tenantId: 'test-tenant-id',
  };
  return render(
    <AddPaymentMethodDialog {...defaultProps} {...props} />
  );
};

describe('AddPaymentMethodDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog content when open', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: /Add Payment Method/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Add a payment method to ensure uninterrupted service/)
    ).toBeInTheDocument();
  });

  it('shows trial features list', () => {
    renderDialog();

    expect(screen.getByText('Full access to all features')).toBeInTheDocument();
    expect(screen.getByText('Unlimited products & customers')).toBeInTheDocument();
    expect(screen.getByText('Priority support')).toBeInTheDocument();
  });

  it('has Remind Me Later and Add Payment Method buttons', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Remind Me Later' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Payment Method' })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Remind Me Later is clicked', async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await userEvent.click(screen.getByRole('button', { name: 'Remind Me Later' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe('loading state during redirect', () => {
    it('shows loading spinner after clicking Add Payment Method', async () => {
      // Simulate a slow response so we can observe loading state
      mockInvoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { url: 'https://stripe.com/setup' }, error: null }), 100))
      );

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('keeps loading state during redirect (does not flash back to idle)', async () => {
      // Simulate successful response with a redirect URL
      mockInvoke.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/setup_session' },
        error: null,
      });

      // Mock window.location to prevent actual navigation
      const originalLocation = window.location;
      const mockLocation = { ...originalLocation, href: 'http://localhost:3000/billing' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      // Wait for the async handler to complete
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // The button should still show "Processing..." — NOT "Add Payment Method"
      // This verifies loading=true is maintained during redirect
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Payment Method' })).not.toBeInTheDocument();

      // Footer buttons should be disabled during redirect
      expect(screen.getByRole('button', { name: 'Remind Me Later' })).toBeDisabled();
      expect(screen.getByText('Processing...').closest('button')).toBeDisabled();

      // Restore window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('resets loading state on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error('Network error'),
      });

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      // After error, loading should reset and button should be clickable again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Payment Method' })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Add Payment Method' })).not.toBeDisabled();
    });

    it('resets loading state when no URL received', async () => {
      mockInvoke.mockResolvedValue({
        data: {},
        error: null,
      });

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      // "No setup URL received" error should reset loading
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Payment Method' })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Add Payment Method' })).not.toBeDisabled();
    });

    it('disables both buttons while loading', async () => {
      mockInvoke.mockImplementation(
        () => new Promise(() => {
          // Never resolves — simulates in-flight request
        })
      );

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Remind Me Later' })).toBeDisabled();
    });
  });

  describe('create-setup-session invocation', () => {
    it('calls create-setup-session with correct tenant_id', async () => {
      mockInvoke.mockResolvedValue({
        data: { url: 'https://stripe.com/setup' },
        error: null,
      });

      // Mock location to prevent navigation
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...originalLocation,
          href: 'http://localhost:3000/test-tenant/admin/billing',
        },
      });

      renderDialog({ tenantId: 'my-tenant-uuid' });
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create-setup-session', {
          body: {
            tenant_id: 'my-tenant-uuid',
            return_url: 'http://localhost:3000/test-tenant/admin/billing',
          },
        });
      });

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
  });
});
