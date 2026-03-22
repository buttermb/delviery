import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// Mocks
// ============================================================================

const mockPerformAction = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: mockPerformAction,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

// Mock CreditCostBadge and OutOfCreditsModal
vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey: string }) => (
    <span data-testid={`credit-cost-badge-${actionKey}`}>{actionKey}</span>
  ),
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted: string }) =>
    open ? <div data-testid="out-of-credits-modal">{actionAttempted}</div> : null,
}));

import { useCredits } from '@/hooks/useCredits';
import { SendPortalLinkDialog } from '../SendPortalLinkDialog';

// ============================================================================
// Test Helpers
// ============================================================================

const defaultClient = {
  id: 'client-1',
  tenant_id: 'tenant-1',
  business_name: 'Acme Corp',
  contact_name: 'John Doe',
  email: 'john@acme.com',
  phone: '+15551234567',
  portal_token: 'abc123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  status: 'active' as const,
  notes: null,
  pricing_tier: null,
  tax_exempt: false,
  payment_terms: null,
  credit_limit: null,
  tags: null,
  custom_fields: null,
  last_order_date: null,
};

const renderDialog = (clientOverrides = {}) => {
  const onOpenChange = vi.fn();
  const client = { ...defaultClient, ...clientOverrides };
  // skipPointerEventsCheck avoids Radix UI Dialog pointer-events:none on body
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const result = render(
    <SendPortalLinkDialog
      open={true}
      onOpenChange={onOpenChange}
      client={client}
    />
  );
  return { ...result, onOpenChange, client, user };
};

// ============================================================================
// Tests
// ============================================================================

describe('SendPortalLinkDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useCredits to default free-tier mock (overrides from prior tests)
    vi.mocked(useCredits).mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      canPerformAction: vi.fn().mockResolvedValue(true),
      performAction: mockPerformAction,
    } as unknown as ReturnType<typeof useCredits>);
    mockPerformAction.mockResolvedValue({ success: true, creditsCost: 25, newBalance: 975 });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  describe('credit cost badges for free tier', () => {
    it('shows SMS credit cost badge when free tier and phone available', () => {
      renderDialog();
      expect(screen.getByTestId('credit-cost-badge-send_sms')).toBeInTheDocument();
    });

    it('shows email credit cost badge when free tier and email available', () => {
      renderDialog();
      expect(screen.getByTestId('credit-cost-badge-send_email')).toBeInTheDocument();
    });

    it('hides credit cost badges when not free tier', () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 1000,
        isFreeTier: false,
        canPerformAction: vi.fn().mockResolvedValue(true),
        performAction: mockPerformAction,
      } as unknown as ReturnType<typeof useCredits>);

      renderDialog();
      expect(screen.queryByTestId('credit-cost-badge-send_sms')).not.toBeInTheDocument();
      expect(screen.queryByTestId('credit-cost-badge-send_email')).not.toBeInTheDocument();
    });
  });

  describe('SMS credit gating', () => {
    it('consumes credits before sending SMS on free tier', async () => {
      const { user } = renderDialog();

      await user.click(screen.getByText(/send via sms/i));

      await waitFor(() => {
        expect(mockPerformAction).toHaveBeenCalledWith('send_sms', 'client-1', 'wholesale_portal_link');
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('send-sms', expect.objectContaining({
          body: expect.objectContaining({ to: '+15551234567' }),
        }));
      });
    });

    it('shows OutOfCreditsModal when SMS credit check fails', async () => {
      mockPerformAction.mockResolvedValue({ success: false, errorMessage: 'Insufficient credits' });

      const { user } = renderDialog();

      await user.click(screen.getByText(/send via sms/i));

      await waitFor(() => {
        expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
        expect(screen.getByTestId('out-of-credits-modal')).toHaveTextContent('send_sms');
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('skips credit check for non-free-tier SMS', async () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 1000,
        isFreeTier: false,
        canPerformAction: vi.fn().mockResolvedValue(true),
        performAction: mockPerformAction,
      } as unknown as ReturnType<typeof useCredits>);

      const { user } = renderDialog();

      await user.click(screen.getByText(/send via sms/i));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('send-sms', expect.anything());
      });

      expect(mockPerformAction).not.toHaveBeenCalled();
    });
  });

  describe('email credit gating', () => {
    it('consumes credits before sending email on free tier', async () => {
      const { user } = renderDialog();

      await user.click(screen.getByText(/send via email/i));

      await waitFor(() => {
        expect(mockPerformAction).toHaveBeenCalledWith('send_email', 'client-1', 'wholesale_portal_link');
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('send-notification', expect.objectContaining({
          body: expect.objectContaining({
            channels: ['email'],
            metadata: expect.objectContaining({ recipient_email: 'john@acme.com' }),
          }),
        }));
      });
    });

    it('shows OutOfCreditsModal when email credit check fails', async () => {
      mockPerformAction.mockResolvedValue({ success: false, errorMessage: 'Insufficient credits' });

      const { user } = renderDialog();

      await user.click(screen.getByText(/send via email/i));

      await waitFor(() => {
        expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
        expect(screen.getByTestId('out-of-credits-modal')).toHaveTextContent('send_email');
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('skips credit check for non-free-tier email', async () => {
      vi.mocked(useCredits).mockReturnValue({
        balance: 1000,
        isFreeTier: false,
        canPerformAction: vi.fn().mockResolvedValue(true),
        performAction: mockPerformAction,
      } as unknown as ReturnType<typeof useCredits>);

      const { user } = renderDialog();

      await user.click(screen.getByText(/send via email/i));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('send-notification', expect.anything());
      });

      expect(mockPerformAction).not.toHaveBeenCalled();
    });
  });
});
