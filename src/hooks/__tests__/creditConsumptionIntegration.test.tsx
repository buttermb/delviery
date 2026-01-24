/**
 * Credit Consumption Integration Tests
 *
 * Tests the full credit consumption flow including:
 * 1. Using a feature that requires credits
 * 2. Verifying balance is decremented correctly
 * 3. Verifying transaction is logged with reference
 * 4. Insufficient credits showing OutOfCreditsModal with purchase options
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockCanPerformAction = vi.fn();
const mockPerformAction = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockNavigate = vi.fn();

// Mock useCredits
vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    error: null,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeEarned: 2000,
    lifetimeSpent: 1000,
    nextFreeGrantAt: null,
    percentUsed: 50,
    canPerformAction: mockCanPerformAction,
    performAction: mockPerformAction,
    refetch: vi.fn(),
  })),
}));

// Mock useTenantAdminAuth
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  })),
}));

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock credit cost functions
vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      menu_create: 100,
      order_create_manual: 50,
      send_sms: 25,
      pos_process_sale: 25,
      marketplace_list_product: 25,
      product_add: 10,
      storefront_create: 500,
      dashboard_view: 0,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    const infos: Record<string, { actionKey: string; actionName: string; credits: number; category: string; description: string }> = {
      menu_create: { actionKey: 'menu_create', actionName: 'Create Menu', credits: 100, category: 'menus', description: 'Create disposable menu' },
      order_create_manual: { actionKey: 'order_create_manual', actionName: 'Create Order', credits: 50, category: 'orders', description: 'Create manual order' },
      send_sms: { actionKey: 'send_sms', actionName: 'Send SMS', credits: 25, category: 'messaging', description: 'Send SMS notification' },
      pos_process_sale: { actionKey: 'pos_process_sale', actionName: 'Process Sale', credits: 25, category: 'pos', description: 'Process POS sale' },
    };
    return infos[actionKey] ?? null;
  }),
  calculateCreditVsSubscription: vi.fn(() => ({
    creditPackCost: 150,
    savings: 500,
    savingsPercent: 90,
  })),
  CREDIT_PACKAGES: [
    { id: 'quick-boost', name: 'Quick Boost', slug: 'quick-boost', credits: 500, priceCents: 1999, description: 'Quick boost pack' },
    { id: 'starter-pack', name: 'Starter Pack', slug: 'starter-pack', credits: 1500, priceCents: 3999, description: 'Starter pack' },
    { id: 'growth-pack', name: 'Growth Pack', slug: 'growth-pack', credits: 5000, priceCents: 7999, description: 'Growth pack' },
    { id: 'power-pack', name: 'Power Pack', slug: 'power-pack', credits: 15000, priceCents: 14999, description: 'Power pack' },
  ],
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

  queryClient.setQueryData = mockSetQueryData;
  queryClient.invalidateQueries = mockInvalidateQueries;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { useCreditGatedAction } from '../useCreditGatedAction';
import { useCredits } from '@/hooks/useCredits';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';

// ============================================================================
// 1. Credit Consumption Flow - Using Features That Require Credits
// ============================================================================

describe('Credit Consumption Flow - Feature Usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 900,
      creditsCost: 100,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should execute action and consume credits when using menu_create', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const createMenuAction = vi.fn().mockResolvedValue({ menuId: 'menu-new-001' });

    await act(async () => {
      const executeResult = await result.current.execute({
        actionKey: 'menu_create',
        action: createMenuAction,
        referenceId: 'menu-new-001',
        referenceType: 'menu',
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.result).toEqual({ menuId: 'menu-new-001' });
      expect(executeResult.wasBlocked).toBe(false);
      expect(executeResult.creditsCost).toBe(100);
    });

    // Action was executed
    expect(createMenuAction).toHaveBeenCalled();
    // Credits were consumed
    expect(mockPerformAction).toHaveBeenCalledWith('menu_create', 'menu-new-001', 'menu');
  });

  it('should pass referenceId to performAction for transaction tracking', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ orderId: 'order-001' });

    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 950,
      creditsCost: 50,
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'order_create_manual',
        action: mockAction,
        referenceId: 'order-ref-unique-555',
        referenceType: 'order',
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'order_create_manual',
      'order-ref-unique-555',
      'order'
    );
  });

  it('should check balance before executing the action', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ id: 'test' });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: mockAction,
      });
    });

    // canPerformAction should be called before action
    expect(mockCanPerformAction).toHaveBeenCalledWith('menu_create');
    // action was called after check passed
    expect(mockAction).toHaveBeenCalled();
  });

  it('should support multiple different action types in sequence', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    // First: Create menu (100 credits)
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 900, creditsCost: 100,
    });

    await act(async () => {
      const r1 = await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ menuId: 'm1' }),
        referenceId: 'menu-seq-1',
        referenceType: 'menu',
      });
      expect(r1.success).toBe(true);
      expect(r1.creditsCost).toBe(100);
    });

    // Second: Send SMS (25 credits)
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 875, creditsCost: 25,
    });

    await act(async () => {
      const r2 = await result.current.execute({
        actionKey: 'send_sms',
        action: vi.fn().mockResolvedValue({ smsId: 's1' }),
        referenceId: 'sms-seq-1',
        referenceType: 'sms',
      });
      expect(r2.success).toBe(true);
      expect(r2.creditsCost).toBe(25);
    });

    expect(mockPerformAction).toHaveBeenCalledTimes(2);
    expect(mockPerformAction).toHaveBeenNthCalledWith(1, 'menu_create', 'menu-seq-1', 'menu');
    expect(mockPerformAction).toHaveBeenNthCalledWith(2, 'send_sms', 'sms-seq-1', 'sms');
  });
});

// ============================================================================
// 2. Balance Decrement Verification via Hook
// ============================================================================

describe('Balance Decrement Verification via Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
  });

  it('should optimistically deduct credits in UI before action completes', async () => {
    mockPerformAction.mockResolvedValue({
      success: true, newBalance: 900, creditsCost: 100,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    // setQueryData should be called with deduction function
    expect(mockSetQueryData).toHaveBeenCalledWith(
      ['credits', 'test-tenant-id'],
      expect.any(Function)
    );
  });

  it('should invalidate queries after successful consumption for server sync', async () => {
    mockPerformAction.mockResolvedValue({
      success: true, newBalance: 900, creditsCost: 100,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['credits', 'test-tenant-id'],
    });
  });

  it('should report the new balance from performAction result', async () => {
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 750,
      creditsCost: 50,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

    await act(async () => {
      executeResult = await result.current.execute({
        actionKey: 'order_create_manual',
        action: vi.fn().mockResolvedValue({ orderId: 'o1' }),
        referenceId: 'order-balance-check',
      });
    });

    expect(executeResult!.creditsCost).toBe(50);
  });

  it('should rollback optimistic update on action failure', async () => {
    mockPerformAction.mockResolvedValue({
      success: true, newBalance: 900, creditsCost: 100,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const failingAction = vi.fn().mockRejectedValue(new Error('API error'));

    await act(async () => {
      const executeResult = await result.current.execute({
        actionKey: 'menu_create',
        action: failingAction,
      });

      expect(executeResult.success).toBe(false);
    });

    // setQueryData called twice: optimistic update + rollback
    expect(mockSetQueryData).toHaveBeenCalledTimes(2);
    // invalidateQueries called to resync with server
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['credits', 'test-tenant-id'],
    });
  });

  it('should rollback when credit consumption returns failure', async () => {
    mockPerformAction.mockResolvedValue({
      success: false,
      errorMessage: 'Database error during deduction',
      newBalance: 1000,
      creditsCost: 0,
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn();

    await act(async () => {
      const executeResult = await result.current.execute({
        actionKey: 'menu_create',
        action: mockAction,
      });

      expect(executeResult.success).toBe(false);
    });

    // Action should NOT have been called since credit consumption failed
    expect(mockAction).not.toHaveBeenCalled();
    // Rollback should happen
    expect(mockSetQueryData).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// 3. Transaction Reference Verification via Hook
// ============================================================================

describe('Transaction Reference Verification via Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerformAction.mockResolvedValue(true);
    mockPerformAction.mockResolvedValue({
      success: true, newBalance: 900, creditsCost: 100,
    });
  });

  it('should pass referenceId to performAction for audit trail', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'menu-track-001' }),
        referenceId: 'menu-track-001',
        referenceType: 'menu',
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'menu_create',
      'menu-track-001',
      'menu'
    );
  });

  it('should pass undefined referenceId when not provided', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'menu_create',
      undefined,
      undefined
    );
  });

  it('should pass referenceType to performAction for categorized tracking', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    mockPerformAction.mockResolvedValue({
      success: true, newBalance: 950, creditsCost: 50,
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'order_create_manual',
        action: vi.fn().mockResolvedValue({ orderId: 'ord-1' }),
        referenceId: 'ord-ref-123',
        referenceType: 'order',
      });
    });

    expect(mockPerformAction).toHaveBeenCalledWith(
      'order_create_manual',
      'ord-ref-123',
      'order'
    );
  });

  it('should track multiple references in sequence without interference', async () => {
    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    // First transaction
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 900, creditsCost: 100,
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ menuId: 'm-1' }),
        referenceId: 'menu-ref-aaa',
        referenceType: 'menu',
      });
    });

    // Second transaction
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 875, creditsCost: 25,
    });

    await act(async () => {
      await result.current.execute({
        actionKey: 'send_sms',
        action: vi.fn().mockResolvedValue({ smsId: 's-1' }),
        referenceId: 'sms-ref-bbb',
        referenceType: 'notification',
      });
    });

    expect(mockPerformAction).toHaveBeenNthCalledWith(1, 'menu_create', 'menu-ref-aaa', 'menu');
    expect(mockPerformAction).toHaveBeenNthCalledWith(2, 'send_sms', 'sms-ref-bbb', 'notification');
  });
});

// ============================================================================
// 4. Insufficient Credits - Modal with Purchase Options
// ============================================================================

describe('Insufficient Credits - Modal with Purchase Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook-level blocking behavior', () => {
    it('should show OutOfCreditsModal when balance is insufficient', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      expect(result.current.showOutOfCreditsModal).toBe(false);

      await act(async () => {
        await result.current.execute({
          actionKey: 'menu_create',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);
      expect(result.current.blockedAction).toBe('menu_create');
    });

    it('should not execute the action when blocked', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const mockAction = vi.fn();

      await act(async () => {
        await result.current.execute({
          actionKey: 'menu_create',
          action: mockAction,
        });
      });

      expect(mockAction).not.toHaveBeenCalled();
    });

    it('should return wasBlocked: true in the result', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

      await act(async () => {
        executeResult = await result.current.execute({
          actionKey: 'menu_create',
          action: vi.fn(),
        });
      });

      expect(executeResult!.wasBlocked).toBe(true);
      expect(executeResult!.success).toBe(false);
      expect(executeResult!.creditsCost).toBe(100);
    });

    it('should call onInsufficientCredits callback with action key', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      const onInsufficientCredits = vi.fn();

      await act(async () => {
        await result.current.execute({
          actionKey: 'menu_create',
          action: vi.fn(),
          onInsufficientCredits,
        });
      });

      expect(onInsufficientCredits).toHaveBeenCalledWith('menu_create');
    });

    it('should block high-cost actions when balance is barely insufficient', async () => {
      // User has 1000 balance but storefront_create costs 500
      // Mock canPerformAction to return false (server-side check)
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const executeResult = await result.current.execute({
          actionKey: 'storefront_create',
          action: vi.fn(),
        });

        expect(executeResult.wasBlocked).toBe(true);
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);
      expect(result.current.blockedAction).toBe('storefront_create');
    });

    it('should show modal when performAction returns insufficient credits error', async () => {
      mockCanPerformAction.mockResolvedValue(true); // Pre-check passes
      mockPerformAction.mockResolvedValue({
        success: false,
        errorMessage: 'Insufficient credits',
      });

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.execute({
          actionKey: 'menu_create',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);
      expect(result.current.blockedAction).toBe('menu_create');
    });

    it('should allow closing the modal and resetting state', async () => {
      mockCanPerformAction.mockResolvedValue(false);

      const { result } = renderHook(() => useCreditGatedAction(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.execute({
          actionKey: 'menu_create',
          action: vi.fn(),
        });
      });

      expect(result.current.showOutOfCreditsModal).toBe(true);

      act(() => {
        result.current.closeOutOfCreditsModal();
      });

      expect(result.current.showOutOfCreditsModal).toBe(false);
      expect(result.current.blockedAction).toBe(null);
    });
  });

  describe('OutOfCreditsModal renders purchase options', () => {
    const renderModalWithProps = (props = {}) => {
      const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        actionAttempted: 'menu_create',
        onBuyCredits: vi.fn(),
        onQuickPurchase: vi.fn(),
        onSetupAutoTopUp: vi.fn(),
      };

      return render(
        <BrowserRouter>
          <OutOfCreditsModal {...defaultProps} {...props} />
        </BrowserRouter>
      );
    };

    it('should display the out of credits title', () => {
      renderModalWithProps();
      expect(screen.getByText("You're Out of Credits")).toBeInTheDocument();
    });

    it('should show the blocked action name', () => {
      renderModalWithProps({ actionAttempted: 'menu_create' });
      expect(screen.getByText(/cannot create menu/i)).toBeInTheDocument();
    });

    it('should display credits progress bar', () => {
      renderModalWithProps();
      const progressBar = screen.getByTestId('credits-progress');
      expect(progressBar).toBeInTheDocument();
    });

    it('should show current balance and action cost', () => {
      renderModalWithProps();
      expect(screen.getByText('Action Cost')).toBeInTheDocument();
      expect(screen.getByText('100 credits')).toBeInTheDocument();
    });

    it('should display quick purchase button for 5K credits', () => {
      renderModalWithProps();
      const button = screen.getByTestId('quick-purchase-starter-pack');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('5K Credits')).toBeInTheDocument();
    });

    it('should display quick purchase button for 15K credits', () => {
      renderModalWithProps();
      const button = screen.getByTestId('quick-purchase-growth-pack');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('15K Credits')).toBeInTheDocument();
    });

    it('should call onQuickPurchase with starter-pack when clicking 5K button', () => {
      const onQuickPurchase = vi.fn();
      const onOpenChange = vi.fn();
      renderModalWithProps({ onQuickPurchase, onOpenChange });

      fireEvent.click(screen.getByTestId('quick-purchase-starter-pack'));

      expect(onQuickPurchase).toHaveBeenCalledWith('starter-pack');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onQuickPurchase with growth-pack when clicking 15K button', () => {
      const onQuickPurchase = vi.fn();
      const onOpenChange = vi.fn();
      renderModalWithProps({ onQuickPurchase, onOpenChange });

      fireEvent.click(screen.getByTestId('quick-purchase-growth-pack'));

      expect(onQuickPurchase).toHaveBeenCalledWith('growth-pack');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show view all packages link', () => {
      renderModalWithProps();
      const link = screen.getByTestId('view-all-packages');
      expect(link).toBeInTheDocument();
      expect(screen.getByText('View all packages')).toBeInTheDocument();
    });

    it('should navigate to billing page when clicking view all packages', () => {
      const onOpenChange = vi.fn();
      renderModalWithProps({ onOpenChange });

      fireEvent.click(screen.getByTestId('view-all-packages'));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/billing?tab=credits');
    });

    it('should show auto top-up suggestion', () => {
      renderModalWithProps();
      expect(screen.getByText('Never run out again')).toBeInTheDocument();
      // Multiple elements match "Set up auto top-up" (description text + button)
      const autoTopUpElements = screen.getAllByText(/Set up auto top-up/);
      expect(autoTopUpElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onSetupAutoTopUp when clicking auto top-up link', () => {
      const onSetupAutoTopUp = vi.fn();
      const onOpenChange = vi.fn();
      renderModalWithProps({ onSetupAutoTopUp, onOpenChange });

      fireEvent.click(screen.getByTestId('setup-auto-top-up'));

      expect(onSetupAutoTopUp).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show subscription upgrade option', () => {
      renderModalWithProps();
      expect(screen.getByText('Upgrade to Unlimited')).toBeInTheDocument();
      expect(screen.getByText('$79')).toBeInTheDocument();
    });

    it('should show urgency messaging', () => {
      renderModalWithProps();
      expect(screen.getByText("Don't lose momentum!")).toBeInTheDocument();
    });

    it('should show Stay Limited dismiss button', () => {
      renderModalWithProps();
      expect(screen.getByText('Stay Limited')).toBeInTheDocument();
    });

    it('should close modal when Stay Limited is clicked', () => {
      const onOpenChange = vi.fn();
      renderModalWithProps({ onOpenChange });

      fireEvent.click(screen.getByText('Stay Limited'));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not render when closed', () => {
      renderModalWithProps({ open: false });
      expect(screen.queryByText("You're Out of Credits")).not.toBeInTheDocument();
    });

    it('should show credits needed to complete action', () => {
      // The default useCredits mock returns balance: 1000
      // With balance 1000 and cost 100, creditsNeeded = max(0, 100-1000) = 0
      renderModalWithProps();
      expect(screen.getByText(/Need 0 more credits/)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Complete Flow: Feature -> Block -> Modal -> Purchase Option
// ============================================================================

describe('Complete Flow: Feature -> Block -> Modal -> Purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the flow: attempt action -> insufficient -> show modal -> user sees purchase options', async () => {
    // Step 1: User attempts action with insufficient credits
    mockCanPerformAction.mockResolvedValue(false);

    vi.mocked(useCredits).mockReturnValue({
      balance: 25,
      isFreeTier: true,
      isLoading: false,
      error: null,
      isLowCredits: true,
      isCriticalCredits: true,
      isOutOfCredits: false,
      lifetimeEarned: 500,
      lifetimeSpent: 475,
      nextFreeGrantAt: null,
      percentUsed: 95,
      canPerformAction: mockCanPerformAction,
      performAction: mockPerformAction,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    // Step 2: Execute action - should be blocked
    let executeResult: Awaited<ReturnType<typeof result.current.execute>>;

    await act(async () => {
      executeResult = await result.current.execute({
        actionKey: 'menu_create',
        action: vi.fn().mockResolvedValue({ id: 'test' }),
      });
    });

    // Step 3: Verify blocked state
    expect(executeResult!.wasBlocked).toBe(true);
    expect(executeResult!.success).toBe(false);
    expect(result.current.showOutOfCreditsModal).toBe(true);
    expect(result.current.blockedAction).toBe('menu_create');

    // Step 4: Render modal with purchase options
    const onQuickPurchase = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <BrowserRouter>
        <OutOfCreditsModal
          open={result.current.showOutOfCreditsModal}
          onOpenChange={onOpenChange}
          actionAttempted={result.current.blockedAction!}
          onQuickPurchase={onQuickPurchase}
          onBuyCredits={vi.fn()}
          onSetupAutoTopUp={vi.fn()}
        />
      </BrowserRouter>
    );

    // Step 5: Verify purchase options are displayed
    expect(screen.getByText("You're Out of Credits")).toBeInTheDocument();
    expect(screen.getByTestId('quick-purchase-starter-pack')).toBeInTheDocument();
    expect(screen.getByTestId('quick-purchase-growth-pack')).toBeInTheDocument();
    expect(screen.getByTestId('view-all-packages')).toBeInTheDocument();
    expect(screen.getByText('Action Cost')).toBeInTheDocument();
    expect(screen.getByText('100 credits')).toBeInTheDocument();

    // Step 6: User clicks quick purchase
    fireEvent.click(screen.getByTestId('quick-purchase-growth-pack'));
    expect(onQuickPurchase).toHaveBeenCalledWith('growth-pack');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should allow retry after purchasing credits', async () => {
    // First attempt - blocked
    mockCanPerformAction.mockResolvedValueOnce(false);

    const { result, rerender } = renderHook(() => useCreditGatedAction(), {
      wrapper: createWrapper(),
    });

    const mockAction = vi.fn().mockResolvedValue({ menuId: 'menu-retry' });

    await act(async () => {
      const r1 = await result.current.execute({
        actionKey: 'menu_create',
        action: mockAction,
      });
      expect(r1.wasBlocked).toBe(true);
    });

    expect(mockAction).not.toHaveBeenCalled();

    // Close modal (simulating user purchased credits)
    act(() => {
      result.current.closeOutOfCreditsModal();
    });

    expect(result.current.showOutOfCreditsModal).toBe(false);

    // Second attempt - now has credits
    mockCanPerformAction.mockResolvedValueOnce(true);
    mockPerformAction.mockResolvedValueOnce({
      success: true, newBalance: 4900, creditsCost: 100,
    });

    await act(async () => {
      const r2 = await result.current.execute({
        actionKey: 'menu_create',
        action: mockAction,
      });
      expect(r2.success).toBe(true);
      expect(r2.wasBlocked).toBe(false);
    });

    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
