/**
 * AddPaymentMethodDialog Tests
 * Verifies the dialog calls create-setup-session edge function correctly,
 * handles errors, renders expected UI elements, and passes return_url.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const TEST_TENANT_ID = 'test-tenant-uuid-1234';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tenantId?: string;
  onSuccess?: () => void;
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  tenantId: TEST_TENANT_ID,
  onSuccess: vi.fn(),
};

const renderDialog = (props: DialogProps = {}) => {
  return render(
    <AddPaymentMethodDialog {...defaultProps} {...props} />
  );
};

describe('AddPaymentMethodDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful setup session
    mockInvoke.mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/test-session', sessionId: 'cs_test_123' },
      error: null,
    });
    // Reset location.href mock
    Object.defineProperty(window, 'location', {
      value: { href: 'https://app.floraiq.com/test-tenant/admin/settings' },
      writable: true,
    });
  });

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      renderDialog();
      const elements = screen.getAllByText('Add Payment Method');
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it('should render trial benefits list', () => {
      renderDialog();
      expect(screen.getByText('Full access to all features')).toBeInTheDocument();
      expect(screen.getByText('Unlimited products & customers')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
    });

    it('should render description text', () => {
      renderDialog();
      expect(screen.getByText(/Add a payment method to ensure uninterrupted service/)).toBeInTheDocument();
    });

    it('should render both action buttons', () => {
      renderDialog();
      expect(screen.getByText('Remind Me Later')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      expect(addButton).toBeDefined();
    });

    it('should not render dialog content when closed', () => {
      renderDialog({ open: false });
      expect(screen.queryByText('Your trial includes:')).not.toBeInTheDocument();
    });
  });

  describe('create-setup-session invocation', () => {
    it('should call create-setup-session with correct tenant_id on button click', async () => {
      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(1);
        expect(mockInvoke).toHaveBeenCalledWith('create-setup-session', {
          body: {
            tenant_id: TEST_TENANT_ID,
            return_url: expect.any(String),
          },
        });
      });
    });

    it('should pass window.location.href as return_url', async () => {
      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      expect(mockInvoke).toHaveBeenCalledWith('create-setup-session', {
        body: {
          tenant_id: TEST_TENANT_ID,
          return_url: 'https://app.floraiq.com/test-tenant/admin/settings',
        },
      });
    });

    it('should include the current page URL, not a hardcoded billing URL', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://app.floraiq.com/my-shop/admin/settings' },
        writable: true,
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      const callArgs = mockInvoke.mock.calls[0];
      expect(callArgs[0]).toBe('create-setup-session');

      const body = callArgs[1]?.body as { return_url: string; tenant_id: string };
      expect(body.return_url).toBe('https://app.floraiq.com/my-shop/admin/settings');
      expect(body.return_url).not.toContain('/billing');
    });

    it('should redirect to Stripe URL on success', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://checkout.stripe.com/session_123' },
        error: null,
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      expect(window.location.href).toBe('https://checkout.stripe.com/session_123');
    });
  });

  describe('Error handling', () => {
    it('should call handleError when edge function returns an error', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function failed' },
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });

    it('should call handleError when no URL is returned', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockInvoke.mockResolvedValueOnce({
        data: { url: null },
        error: null,
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });

    it('should call handleError when invoke throws', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner during setup', async () => {
      mockInvoke.mockReturnValue(new Promise(() => {}));

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('should disable buttons during loading', async () => {
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

    it('keeps loading state during redirect (does not flash back to idle)', async () => {
      mockInvoke.mockResolvedValue({
        data: { url: 'https://checkout.stripe.com/setup_session' },
        error: null,
      });

      const originalLocation = window.location;
      const mockLocation = { ...originalLocation, href: 'http://localhost:3000/billing' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Add Payment Method' }));

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

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Payment Method' })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Add Payment Method' })).not.toBeDisabled();
    });
  });

  describe('Dismiss behavior', () => {
    it('should call onOpenChange(false) when Remind Me Later is clicked', () => {
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });

      fireEvent.click(screen.getByText('Remind Me Later'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
