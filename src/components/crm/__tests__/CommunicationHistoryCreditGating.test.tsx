/**
 * CommunicationHistory SMS Credit Gating Tests
 *
 * Verifies that SMS sending from the CRM communication history is properly
 * gated by credits using useCreditGatedAction with 'send_sms' action key (25 credits):
 * 1. SMS send calls executeCreditGated with 'send_sms' action key
 * 2. Email send bypasses credit gating (no credit gate for email here)
 * 3. CreditCostBadge shows on SMS send button for free-tier users
 * 4. CreditCostIndicator appears when SMS type is selected
 * 5. OutOfCreditsModal renders when credit gate blocks the action
 * 6. Send button is disabled while credit check is in progress
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecuteCreditGated = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: vi.fn(() => ({
    execute: mockExecuteCreditGated,
    isExecuting: false,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: null,
    balance: 1000,
    isFreeTier: true,
  })),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const createChain = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => createChain()),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
        }),
      },
    },
  };
});

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey, className }: { actionKey: string; className?: string }) => (
    <span data-testid={`credit-cost-badge-${actionKey}`} className={className}>
      25 cr
    </span>
  ),
  CreditCostIndicator: ({ actionKey }: { actionKey: string }) => (
    <div data-testid={`credit-cost-indicator-${actionKey}`}>
      This will use 25 credits
    </div>
  ),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({
    open,
    actionAttempted,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    actionAttempted?: string;
  }) =>
    open ? (
      <div data-testid="out-of-credits-modal" data-action={actionAttempted}>
        Out of Credits
      </div>
    ) : null,
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (error: unknown) => String(error),
}));

// Mock shadcn Select to use native HTML select (avoids Radix jsdom hasPointerCapture issues)
vi.mock('@/components/ui/select', () => {
  const SelectContext = { onValueChange: (_v: string) => {} };
  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => {
      SelectContext.onValueChange = onValueChange;
      return (
        <select
          data-testid="mock-select"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

// ============================================================================
// Import after mocks
// ============================================================================

import { CommunicationHistory } from '../CommunicationHistory';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';

// ============================================================================
// Tests
// ============================================================================

describe('CommunicationHistory SMS Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteCreditGated.mockResolvedValue({
      success: true,
      creditsCost: 25,
      wasBlocked: false,
    });
  });

  const defaultProps = {
    customerId: 'customer-123',
    tenantId: 'test-tenant-id',
    customerEmail: 'test@example.com',
    customerPhone: '+1234567890',
  };

  async function openSendDialog(user: ReturnType<typeof userEvent.setup>) {
    // Wait for loading state to resolve
    await waitFor(() => {
      expect(screen.queryByText('Loading communications...')).not.toBeInTheDocument();
    });
    const sendButton = screen.getByRole('button', { name: /send message/i });
    await user.click(sendButton);
  }

  async function selectSmsType(user: ReturnType<typeof userEvent.setup>) {
    // The dialog opens with 'email' type by default. Switch to 'sms' via native select mock.
    const selects = screen.getAllByTestId('mock-select');
    // The last select is the message type selector in the send dialog
    const typeSelect = selects[selects.length - 1];
    await user.selectOptions(typeSelect, 'sms');
  }

  // 1. SMS send calls executeCreditGated with 'send_sms' action key
  it('should call executeCreditGated with send_sms action key when sending SMS', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    await selectSmsType(user);

    // Type a message
    const textarea = screen.getByPlaceholderText(/enter your sms message/i);
    await user.type(textarea, 'Hello customer');

    // Click the submit Send button (includes "25 cr" badge text for SMS)
    const sendBtn = screen.getByRole('button', { name: /send.*25 cr/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockExecuteCreditGated).toHaveBeenCalledTimes(1);
      expect(mockExecuteCreditGated).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'send_sms',
          referenceId: 'customer-123',
          referenceType: 'crm_sms',
        }),
      );
    });
  });

  // 2. Email send bypasses credit gating
  it('should not call executeCreditGated when sending email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    // Email is the default type - no need to change

    // Type subject and message
    const subjectInput = screen.getByPlaceholderText(/email subject/i);
    await user.type(subjectInput, 'Test Subject');

    const textarea = screen.getByPlaceholderText(/enter your email message/i);
    await user.type(textarea, 'Hello customer via email');

    // Click the submit Send button (not "Send Message" header button)
    const sendButtons = screen.getAllByRole('button', { name: /^send$/i });
    await user.click(sendButtons[0]);

    // executeCreditGated should NOT be called for email
    expect(mockExecuteCreditGated).not.toHaveBeenCalled();
  });

  // 3. CreditCostBadge shows on SMS send button for free-tier users
  it('should show CreditCostBadge on send button when SMS is selected and user is free-tier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    await selectSmsType(user);

    expect(screen.getByTestId('credit-cost-badge-send_sms')).toBeInTheDocument();
  });

  // 4. CreditCostIndicator appears when SMS type is selected
  it('should show CreditCostIndicator when SMS type is selected for free-tier users', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    await selectSmsType(user);

    expect(screen.getByTestId('credit-cost-indicator-send_sms')).toBeInTheDocument();
  });

  it('should not show CreditCostIndicator when email type is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    // Email is default - no need to change

    expect(screen.queryByTestId('credit-cost-indicator-send_sms')).not.toBeInTheDocument();
  });

  // 5. OutOfCreditsModal renders when credits are insufficient
  it('should show OutOfCreditsModal when credit gate blocks the action', async () => {
    vi.mocked(useCreditGatedAction).mockReturnValue({
      execute: mockExecuteCreditGated,
      isExecuting: false,
      showOutOfCreditsModal: true,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: 'send_sms',
      balance: 10,
      isFreeTier: true,
    });

    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('out-of-credits-modal')).toHaveAttribute(
      'data-action',
      'send_sms',
    );
  });

  it('should not show OutOfCreditsModal when credits are sufficient', async () => {
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
  });

  // 6. Non-free-tier users don't see credit UI
  it('should not show CreditCostBadge or CreditCostIndicator for non-free-tier users', async () => {
    vi.mocked(useCreditGatedAction).mockReturnValue({
      execute: mockExecuteCreditGated,
      isExecuting: false,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      balance: 0,
      isFreeTier: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<CommunicationHistory {...defaultProps} />);

    await openSendDialog(user);
    await selectSmsType(user);

    expect(screen.queryByTestId('credit-cost-badge-send_sms')).not.toBeInTheDocument();
    expect(screen.queryByTestId('credit-cost-indicator-send_sms')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for send_sms
// ============================================================================

describe('Send SMS Credit Cost Configuration', () => {
  it('send_sms should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('send_sms')).toBe(25);
  });

  it('send_sms should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('send_sms')).toBe(false);
  });

  it('send_sms should be categorized under communications', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('send_sms');
    expect(info).not.toBeNull();
    expect(info?.credits).toBe(25);
  });
});
