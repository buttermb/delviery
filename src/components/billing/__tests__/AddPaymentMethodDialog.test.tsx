/**
 * AddPaymentMethodDialog Tests
 * Verifies the dialog calls create-setup-session edge function correctly,
 * handles errors, and renders expected UI elements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddPaymentMethodDialog } from '../AddPaymentMethodDialog';

// Mock supabase client
const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock error handler
const mockHandleError = vi.fn();
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const TEST_TENANT_ID = 'test-tenant-uuid-1234';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  tenantId: TEST_TENANT_ID,
};

const renderDialog = (props = {}) => {
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
  });

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      renderDialog();
      // Title and button both contain "Add Payment Method"
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
      // The "Add Payment Method" text appears in both the title and button
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
      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        const callArgs = mockInvoke.mock.calls[0];
        expect(callArgs[0]).toBe('create-setup-session');
        expect(callArgs[1].body.return_url).toBe(window.location.href);
      });
    });

    it('should redirect to Stripe URL on success', async () => {
      const stripeUrl = 'https://checkout.stripe.com/test-redirect';
      mockInvoke.mockResolvedValue({
        data: { url: stripeUrl, sessionId: 'cs_test_456' },
        error: null,
      });

      // Mock window.location.href setter
      const originalHref = window.location.href;
      const hrefSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: originalHref },
        writable: true,
      });
      Object.defineProperty(window.location, 'href', {
        set: hrefSetter,
        get: () => originalHref,
      });

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(hrefSetter).toHaveBeenCalledWith(stripeUrl);
      });
    });
  });

  describe('Error handling', () => {
    it('should call handleError when edge function returns an error', async () => {
      const testError = new Error('Edge function failed');
      mockInvoke.mockResolvedValue({
        data: null,
        error: testError,
      });

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(mockHandleError).toHaveBeenCalledWith(
          testError,
          { component: 'AddPaymentMethodDialog', toastTitle: 'Error' }
        );
      });
    });

    it('should call handleError when no URL is returned', async () => {
      mockInvoke.mockResolvedValue({
        data: { url: null },
        error: null,
      });

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(mockHandleError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'No setup URL received' }),
          { component: 'AddPaymentMethodDialog', toastTitle: 'Error' }
        );
      });
    });

    it('should call handleError when invoke throws', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        expect(mockHandleError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Network error' }),
          { component: 'AddPaymentMethodDialog', toastTitle: 'Error' }
        );
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner during setup', async () => {
      // Make invoke hang to keep loading state
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
      mockInvoke.mockReturnValue(new Promise(() => {}));

      renderDialog();

      const buttons = screen.getAllByRole('button');
      const addButton = buttons.find(b => b.textContent === 'Add Payment Method');
      fireEvent.click(addButton!);

      await waitFor(() => {
        const allButtons = screen.getAllByRole('button');
        // Dialog close button, Remind Me Later, and Add Payment Method button
        const remindButton = allButtons.find(b => b.textContent === 'Remind Me Later');
        const processingButton = allButtons.find(b => b.textContent?.includes('Processing'));
        expect(remindButton).toBeDisabled();
        expect(processingButton).toBeDisabled();
      });
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
