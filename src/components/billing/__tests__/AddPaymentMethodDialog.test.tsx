/**
 * AddPaymentMethodDialog Tests
 * Verifies return_url includes current page URL when invoking create-setup-session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPaymentMethodDialog } from '../AddPaymentMethodDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { url: 'https://checkout.stripe.com/test' }, error: null }),
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

const mockedInvoke = vi.mocked(supabase.functions.invoke);

const renderDialog = (props: Partial<{ open: boolean; tenantId: string }> = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    tenantId: 'test-tenant-id',
    onSuccess: vi.fn(),
  };
  return render(
    <AddPaymentMethodDialog {...defaultProps} {...props} />
  );
};

describe('AddPaymentMethodDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset location.href mock
    Object.defineProperty(window, 'location', {
      value: { href: 'https://app.floraiq.com/test-tenant/admin/settings' },
      writable: true,
    });
  });

  describe('return_url handling', () => {
    it('should pass window.location.href as return_url to create-setup-session', async () => {
      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      expect(mockedInvoke).toHaveBeenCalledWith('create-setup-session', {
        body: {
          tenant_id: 'test-tenant-id',
          return_url: 'https://app.floraiq.com/test-tenant/admin/settings',
        },
      });
    });

    it('should include the current page URL, not a hardcoded billing URL', async () => {
      // Simulate being on a different page (e.g., settings)
      Object.defineProperty(window, 'location', {
        value: { href: 'https://app.floraiq.com/my-shop/admin/settings' },
        writable: true,
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      const callArgs = mockedInvoke.mock.calls[0];
      expect(callArgs[0]).toBe('create-setup-session');

      const body = callArgs[1]?.body as { return_url: string; tenant_id: string };
      expect(body.return_url).toBe('https://app.floraiq.com/my-shop/admin/settings');
      expect(body.return_url).not.toContain('/billing');
    });

    it('should redirect to the Stripe checkout URL on success', async () => {
      mockedInvoke.mockResolvedValueOnce({
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

  describe('error handling', () => {
    it('should call handleError when supabase returns an error', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockedInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Test error' },
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      expect(handleError).toHaveBeenCalled();
    });

    it('should call handleError when no URL is returned', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');
      mockedInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const user = userEvent.setup();
      renderDialog();

      const addButton = screen.getByRole('button', { name: 'Add Payment Method' });
      await user.click(addButton);

      expect(handleError).toHaveBeenCalled();
    });
  });

  describe('dialog rendering', () => {
    it('should not render when closed', () => {
      renderDialog({ open: false });
      expect(screen.queryByText('Add Payment Method')).not.toBeInTheDocument();
    });

    it('should render dialog title and description when open', () => {
      renderDialog({ open: true });
      expect(screen.getByText('Add Payment Method', { selector: 'button' })).toBeInTheDocument();
      expect(screen.getByText(/Add a payment method/)).toBeInTheDocument();
    });
  });
});
