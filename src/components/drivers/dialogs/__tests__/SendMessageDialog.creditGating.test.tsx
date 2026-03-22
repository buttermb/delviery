/**
 * SendMessageDialog Credit Gating Tests
 *
 * Verifies that driver message sending is gated by credits:
 * 1. send_sms action key is used (25 credits)
 * 2. useCreditGatedAction hook is integrated in SendMessageDialog
 * 3. Credit check blocks sending when insufficient credits
 * 4. Credit check allows sending when sufficient credits
 * 5. Button is disabled while credit action is performing
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

const mockExecute = vi.fn();
let mockIsPerforming = false;

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    token: 'test-token',
    isAuthenticated: true,
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: mockIsPerforming,
    isFreeTier: true,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ count: 1 })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

const defaultDriver = {
  id: 'driver-1',
  full_name: 'John Driver',
  email: 'john@example.com',
  phone: '5551234567',
};

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
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('SendMessageDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPerforming = false;
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the send message dialog', async () => {
    const { SendMessageDialog } = await import('../SendMessageDialog');
    renderWithProviders(
      <SendMessageDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={defaultDriver}
        tenantId="test-tenant-id"
      />
    );

    expect(screen.getByText('Message John Driver')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with send_sms action key on send', async () => {
    const user = userEvent.setup();
    const { SendMessageDialog } = await import('../SendMessageDialog');
    renderWithProviders(
      <SendMessageDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={defaultDriver}
        tenantId="test-tenant-id"
      />
    );

    // Fill in email subject and body (Email is default channel)
    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Write your message...');
    await user.type(bodyInput, 'Test body message');

    // Click send
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'send_sms',
        expect.any(Function)
      );
    });
  });

  it('should not send message when credit gate blocks the action', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    // Simulate credit gate blocking (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { SendMessageDialog } = await import('../SendMessageDialog');
    renderWithProviders(
      <SendMessageDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={defaultDriver}
        tenantId="test-tenant-id"
      />
    );

    // Fill in email subject and body
    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Write your message...');
    await user.type(bodyInput, 'Test body message');

    // Click send
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('send_sms', expect.any(Function));
    });

    // The supabase insert should NOT have been called (action was blocked)
    const fromFn = supabase.from as ReturnType<typeof vi.fn>;
    const insertCalls = fromFn.mock.results
      .filter((r: { type: string; value: { insert: unknown } }) => r.type === 'return')
      .flatMap((r: { type: string; value: { insert: ReturnType<typeof vi.fn> } }) =>
        r.value.insert?.mock?.calls ?? []
      );
    expect(insertCalls).toHaveLength(0);
  });

  it('should disable send button while credit action is performing', async () => {
    mockIsPerforming = true;

    const { SendMessageDialog } = await import('../SendMessageDialog');
    renderWithProviders(
      <SendMessageDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={defaultDriver}
        tenantId="test-tenant-id"
      />
    );

    const sendBtn = screen.getByRole('button', { name: /sending/i });
    expect(sendBtn).toBeDisabled();
  });

  it('should show "Sending..." text while performing', async () => {
    mockIsPerforming = true;

    const { SendMessageDialog } = await import('../SendMessageDialog');
    renderWithProviders(
      <SendMessageDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={defaultDriver}
        tenantId="test-tenant-id"
      />
    );

    expect(screen.getByText('Sending...')).toBeInTheDocument();
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

  it('send_sms should be categorized under crm', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('send_sms');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('crm');
    expect(info?.actionName).toBe('Send SMS');
    expect(info?.credits).toBe(25);
  });
});
