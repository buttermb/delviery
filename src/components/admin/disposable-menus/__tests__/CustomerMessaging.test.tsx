/**
 * CustomerMessaging Component Tests
 *
 * Tests credit gating for bulk SMS sending (20 credits per recipient):
 * 1. Shows estimated credit cost when SMS channel selected
 * 2. Opens BulkCreditCalculator on SMS send
 * 3. Gates SMS sending through useCreditGatedAction
 * 4. Sends email directly without credit gating
 * 5. Shows OutOfCreditsModal on insufficient credits
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecuteCreditAction = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();
const mockBulkCalculatorOpen = vi.fn();
const mockCheckLimit = vi.fn().mockReturnValue({ allowed: true });
const mockRecordAction = vi.fn();

// Mock useCreditGatedAction
vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: vi.fn(() => ({
    execute: mockExecuteCreditAction,
    isExecuting: false,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: null,
    balance: 1000,
    isFreeTier: true,
  })),
}));

// Mock useCredits (used by CreditCostBadge)
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    percentUsed: 10,
    hasCredits: vi.fn().mockReturnValue(true),
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn(),
    refetch: vi.fn(),
    invalidate: vi.fn(),
  })),
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant', business_name: 'Test Business' },
    tenantSlug: 'test-tenant',
  })),
}));

// Mock useFreeTierLimits
vi.mock('@/hooks/useFreeTierLimits', () => ({
  useFreeTierLimits: vi.fn(() => ({
    checkLimit: mockCheckLimit,
    recordAction: mockRecordAction,
    limitsApply: false,
  })),
}));

// Mock useMenuOrders with customer data
vi.mock('@/hooks/useDisposableMenus', () => ({
  useMenuOrders: vi.fn(() => ({
    data: [
      { contact_phone: '+1234567890', created_at: '2026-01-01', status: 'completed' },
      { contact_phone: '+0987654321', created_at: '2026-01-02', status: 'pending' },
      { contact_phone: '+1112223333', created_at: '2026-01-03', status: 'completed' },
    ],
  })),
}));

// Mock BulkCreditCalculator
vi.mock('@/components/credits/BulkCreditCalculator', () => ({
  BulkCreditCalculator: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) => {
    if (!open) return null;
    return (
      <div data-testid="bulk-credit-calculator">
        <button data-testid="confirm-bulk-cost" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    );
  },
  useBulkCreditCalculator: vi.fn(({ onConfirm }: { onConfirm: () => void }) => ({
    open: mockBulkCalculatorOpen,
    close: vi.fn(),
    calculatorProps: {
      open: false,
      onOpenChange: vi.fn(),
      actionKey: 'send_bulk_sms',
      itemCount: 3,
      onConfirm,
      isLoading: false,
    },
    totalCost: 60,
    canAfford: true,
  })),
}));

// Mock OutOfCreditsModal
vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open }: { open: boolean }) => {
    if (!open) return null;
    return <div data-testid="out-of-credits-modal">Out of Credits</div>;
  },
}));

// Mock CreditCostBadge
vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ cost }: { cost?: number }) => (
    <span data-testid="credit-cost-badge">{cost}</span>
  ),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock formatPhoneNumber
vi.mock('@/lib/formatters', () => ({
  formatPhoneNumber: (phone: string) => phone,
}));

// Mock queryKeys
vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    customers: { list: (id: string) => ['customers', 'list', id] },
    credits: { balance: (id: string) => ['credits', 'balance', id], all: ['credits'] },
  },
}));

// Mock credit cost functions
vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((key: string) => {
    if (key === 'send_bulk_sms') return 20;
    if (key === 'send_sms') return 25;
    return 0;
  }),
  getCreditCostInfo: vi.fn(() => ({
    actionName: 'Send Bulk SMS',
    credits: 20,
    description: 'Send bulk SMS (volume discount)',
  })),
  CREDIT_PACKAGES: [],
  FREE_TIER_MONTHLY_CREDITS: 500,
  MIN_BALANCE_REQUIREMENTS: {
    require_full_balance: [],
    min_buffer: 0,
    buffer_percentage: 0,
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { CustomerMessaging } from '../CustomerMessaging';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';
import { toast } from 'sonner';

describe('CustomerMessaging - Credit Gated Bulk SMS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteCreditAction.mockResolvedValue({
      success: true,
      creditsCost: 60,
      wasBlocked: false,
    });
  });

  it('renders the send bulk message form', () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    expect(screen.getByText('Send Bulk Message')).toBeInTheDocument();
    expect(screen.getByText('3 recipients selected')).toBeInTheDocument();
  });

  it('shows estimated credit cost when SMS channel is selected', () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);

    // Select SMS option
    const smsOption = screen.getByText('SMS');
    fireEvent.click(smsOption);

    // Should show estimated cost: 3 recipients * 20 credits = 60
    expect(screen.getByText('Est. 60 credits')).toBeInTheDocument();
    expect(screen.getByTestId('credit-cost-badge')).toHaveTextContent('20');
  });

  it('shows credit cost on send button when SMS is selected', () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);
    fireEvent.click(screen.getByText('SMS'));

    // Button should show credit cost
    expect(screen.getByText('(60 credits)')).toBeInTheDocument();
  });

  it('opens BulkCreditCalculator when sending SMS', async () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);
    fireEvent.click(screen.getByText('SMS'));

    // Type a message
    const messageInput = screen.getByPlaceholderText(/Type your message/);
    fireEvent.change(messageInput, { target: { value: 'Test message' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: /Send to/i });
    fireEvent.click(sendButton);

    // Should open bulk credit calculator
    expect(mockBulkCalculatorOpen).toHaveBeenCalled();
  });

  it('sends email directly without credit gating', async () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Keep email channel (default)
    // Type subject and message
    const subjectInput = screen.getByPlaceholderText('Email subject line');
    fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });

    const messageInput = screen.getByPlaceholderText(/Type your message/);
    fireEvent.change(messageInput, { target: { value: 'Test email body' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: /Send to/i });
    fireEvent.click(sendButton);

    // Should NOT open bulk credit calculator (email path)
    expect(mockBulkCalculatorOpen).not.toHaveBeenCalled();
  });

  it('validates message is not empty before opening calculator', async () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);
    fireEvent.click(screen.getByText('SMS'));

    // Click send without message
    const sendButton = screen.getByRole('button', { name: /Send to/i });
    fireEvent.click(sendButton);

    // Should show error instead of opening calculator
    expect(toast.error).toHaveBeenCalledWith('Please enter a message to send.');
    expect(mockBulkCalculatorOpen).not.toHaveBeenCalled();
  });

  it('does not show credit cost when not on free tier', () => {
    vi.mocked(useCreditGatedAction).mockReturnValue({
      execute: mockExecuteCreditAction,
      isExecuting: false,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      balance: 1000,
      isFreeTier: false,
    });

    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);
    fireEvent.click(screen.getByText('SMS'));

    // Should not show estimated cost
    expect(screen.queryByText(/Est\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/credits\)/)).not.toBeInTheDocument();
  });

  it('shows OutOfCreditsModal when credit action is blocked', () => {
    vi.mocked(useCreditGatedAction).mockReturnValue({
      execute: mockExecuteCreditAction,
      isExecuting: false,
      showOutOfCreditsModal: true,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: 'send_bulk_sms',
      balance: 10,
      isFreeTier: true,
    });

    render(<CustomerMessaging />, { wrapper: createWrapper() });

    expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
  });

  it('disables send button while credit action is executing', () => {
    vi.mocked(useCreditGatedAction).mockReturnValue({
      execute: mockExecuteCreditAction,
      isExecuting: true,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      balance: 1000,
      isFreeTier: true,
    });

    render(<CustomerMessaging />, { wrapper: createWrapper() });

    const sendButton = screen.getByRole('button', { name: /Sending/i });
    expect(sendButton).toBeDisabled();
  });

  it('displays correct cost for filtered recipients', () => {
    render(<CustomerMessaging />, { wrapper: createWrapper() });

    // Switch to SMS channel
    const selectTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(selectTrigger);
    fireEvent.click(screen.getByText('SMS'));

    // All 3 recipients: 3 * 20 = 60
    expect(screen.getByText('Est. 60 credits')).toBeInTheDocument();

    // Filter to pending (only 1 recipient)
    const statusTrigger = screen.getAllByRole('combobox')[1];
    fireEvent.click(statusTrigger);
    fireEvent.click(screen.getByText('Pending Orders'));

    // 1 recipient: 1 * 20 = 20
    expect(screen.getByText('Est. 20 credits')).toBeInTheDocument();
  });
});
