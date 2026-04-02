/**
 * SendAccessLinkDialog Credit Gating Tests
 *
 * Tests that the dialog correctly integrates useCreditGatedAction:
 * 1. Uses correct action key based on selected method (send_email / send_sms)
 * 2. Shows OutOfCreditsModal when credits are insufficient
 * 3. Calls edge function inside the credit-gated action
 * 4. Shows CreditCostBadge for free tier users
 * 5. Disables send button while executing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ============================================================================
// Mocks (must be hoisted before imports)
// ============================================================================

const mockExecute = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

const mockCreditGatedReturn = {
  execute: mockExecute,
  isExecuting: false,
  showOutOfCreditsModal: false,
  closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
  blockedAction: null as string | null,
  balance: 1000,
  isFreeTier: true,
};

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: () => mockCreditGatedReturn,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    error: null,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeEarned: 1000,
    lifetimeSpent: 0,
    nextFreeGrantAt: null,
    percentUsed: 0,
    refetch: vi.fn(),
    lifetimeStats: { earned: 1000, spent: 0, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'none', isFreeTier: true, creditsPerPeriod: 1000, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    hasCredits: vi.fn().mockReturnValue(true),
    invalidate: vi.fn(),
  }),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      send_sms: 25,
      send_email: 10,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionName: string; credits: number; description: string }> = {
      send_sms: { actionName: 'Send SMS', credits: 25, description: 'Send an SMS notification' },
      send_email: { actionName: 'Send Email', credits: 10, description: 'Send an email notification' },
    };
    return infos[actionKey] ?? null;
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { preview: { message: 'Test preview message' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? <div data-testid="out-of-credits-modal">Out of Credits - {actionAttempted}</div> : null,
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { SendAccessLinkDialog } from '../SendAccessLinkDialog';

// ============================================================================
// Test Setup
// ============================================================================

const defaultWhitelistEntry = {
  id: 'whitelist-123',
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  customer_phone: '+1234567890',
  unique_access_token: 'abc-token-123',
};

function renderDialog(props?: Partial<Parameters<typeof SendAccessLinkDialog>[0]>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SendAccessLinkDialog
          open={true}
          onClose={vi.fn()}
          whitelistEntry={defaultWhitelistEntry}
          menuTitle="Test Menu"
          {...props}
        />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('SendAccessLinkDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ success: true, wasBlocked: false });
  });

  describe('Rendering', () => {
    it('should render the dialog with send options', () => {
      renderDialog();

      expect(screen.getByText('Send Access Link')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /sms/i })).toBeInTheDocument();
    });

    it('should show CreditCostBadge for SMS option on free tier', () => {
      renderDialog();

      // There should be credit badges rendered (25 for SMS, 10 for email)
      const badges = screen.getAllByText('25');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should show CreditCostBadge for email option on free tier', () => {
      renderDialog();

      const badges = screen.getAllByText('10');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Credit Gated SMS Sending', () => {
    it('should call executeCreditAction with send_sms when SMS is selected', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Select SMS method
      const smsRadio = screen.getByLabelText(/SMS/);
      await user.click(smsRadio);

      // Click send button
      const sendButton = screen.getByRole('button', { name: /send via sms/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            actionKey: 'send_sms',
            referenceId: 'whitelist-123',
            referenceType: 'menu_access',
          })
        );
      });
    });

    it('should call executeCreditAction with send_email when email is selected', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Email is default selected, just click send
      const sendButton = screen.getByRole('button', { name: /send via email/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            actionKey: 'send_email',
            referenceId: 'whitelist-123',
            referenceType: 'menu_access',
          })
        );
      });
    });

    it('should pass action function that invokes the edge function', async () => {
      const user = userEvent.setup();

      // Capture the action function passed to execute
      mockExecute.mockImplementation(async (options: { action: () => Promise<unknown> }) => {
        await options.action();
        return { success: true, wasBlocked: false };
      });

      renderDialog();

      const sendButton = screen.getByRole('button', { name: /send via email/i });
      await user.click(sendButton);

      const { supabase } = await import('@/integrations/supabase/client');

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('send-menu-access-link', {
          body: {
            whitelistId: 'whitelist-123',
            method: 'email',
          },
        });
      });
    });

    it('should pass onError callback to executeCreditAction', async () => {
      const user = userEvent.setup();
      renderDialog();

      const sendButton = screen.getByRole('button', { name: /send via email/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            onError: expect.any(Function),
          })
        );
      });
    });
  });

  describe('OutOfCreditsModal', () => {
    it('should render OutOfCreditsModal when showOutOfCreditsModal is true', () => {
      // Temporarily override mock return values
      mockCreditGatedReturn.showOutOfCreditsModal = true;
      mockCreditGatedReturn.blockedAction = 'send_sms';
      mockCreditGatedReturn.balance = 0;

      renderDialog();

      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
      expect(screen.getByText(/Out of Credits - send_sms/)).toBeInTheDocument();

      // Restore defaults
      mockCreditGatedReturn.showOutOfCreditsModal = false;
      mockCreditGatedReturn.blockedAction = null;
      mockCreditGatedReturn.balance = 1000;
    });

    it('should not render OutOfCreditsModal when showOutOfCreditsModal is false', () => {
      renderDialog();

      expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
    });
  });

  describe('Copy Link', () => {
    it('should copy access link to clipboard', async () => {
      const user = userEvent.setup();

      // Mock clipboard via defineProperty since navigator.clipboard is readonly
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      renderDialog();

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await user.click(copyButton);

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('/menu/abc-token-123')
      );
    });
  });

  describe('Menu title display', () => {
    it('should show menu title in dialog description', () => {
      renderDialog({ menuTitle: 'Premium Menu' });

      expect(screen.getByText(/Premium Menu access link to John Doe/)).toBeInTheDocument();
    });
  });

  describe('Preview display', () => {
    it('should display email preview with subject and message', async () => {
      const user = userEvent.setup();

      // Make execute call the action so preview state is set
      mockExecute.mockImplementation(async (options: { action: () => Promise<unknown> }) => {
        await options.action();
        return { success: true, wasBlocked: false };
      });

      // Mock supabase to return email preview
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { preview: { subject: 'Access to Test Menu', message: 'Hello, here is your link.' } },
        error: null,
      });

      renderDialog();

      const sendButton = screen.getByRole('button', { name: /send via email/i });
      await user.click(sendButton);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /message preview/i });
        expect(textarea).toHaveValue('Access to Test Menu\n\nHello, here is your link.');
      });
    });

    it('should display SMS preview with message only', async () => {
      const user = userEvent.setup();

      mockExecute.mockImplementation(async (options: { action: () => Promise<unknown> }) => {
        await options.action();
        return { success: true, wasBlocked: false };
      });

      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { preview: { message: 'Test Menu: Access your menu at https://example.com/menu/abc123' } },
        error: null,
      });

      renderDialog();

      // Select SMS
      const smsRadio = screen.getByLabelText(/SMS/);
      await user.click(smsRadio);

      const sendButton = screen.getByRole('button', { name: /send via sms/i });
      await user.click(sendButton);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /message preview/i });
        expect(textarea).toHaveValue('Test Menu: Access your menu at https://example.com/menu/abc123');
      });
    });
  });

  describe('Disabled states', () => {
    it('should disable email option when no email on file', () => {
      renderDialog({
        whitelistEntry: {
          ...defaultWhitelistEntry,
          customer_email: null,
        },
      });

      const emailRadio = screen.getByRole('radio', { name: /email/i });
      expect(emailRadio).toBeDisabled();
    });

    it('should disable SMS option when no phone on file', () => {
      renderDialog({
        whitelistEntry: {
          ...defaultWhitelistEntry,
          customer_phone: null,
        },
      });

      const smsRadio = screen.getByRole('radio', { name: /sms/i });
      expect(smsRadio).toBeDisabled();
    });

    it('should show warning when no contact info available', () => {
      renderDialog({
        whitelistEntry: {
          ...defaultWhitelistEntry,
          customer_email: null,
          customer_phone: null,
        },
      });

      expect(screen.getByText(/no contact information available/i)).toBeInTheDocument();
    });
  });
});
