/**
 * CreditDeductionToast Tests
 *
 * Verifies:
 * - Renders deduction amount and action name
 * - Shows remaining balance
 * - Auto-dismisses after 3 seconds
 * - Fade-out animation triggers before dismiss
 * - Color-codes based on remaining balance thresholds
 * - Opens CreditPurchaseModal on click
 * - Shows "Tap to upgrade" for low balance
 * - CreditToastManager stacks multiple toasts
 * - showCreditDeductionToast helper triggers manager
 * - CreditToastContainer renders via portal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  CreditDeductionToast,
  creditToastManager,
  showCreditDeductionToast,
  CreditToastContainer,
} from '../CreditDeductionToast';

// Mock CreditPurchaseModal to avoid rendering the full modal
vi.mock('../CreditPurchaseModal', () => ({
  CreditPurchaseModal: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? (
      <div data-testid="credit-purchase-modal">
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

describe('CreditDeductionToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render deduction amount and action name', () => {
      render(
        <CreditDeductionToast amount={25} action="Menu Order" newBalance={4975} />
      );

      expect(screen.getByText('-25 credits')).toBeInTheDocument();
      expect(screen.getByText('(Menu Order)')).toBeInTheDocument();
    });

    it('should show remaining balance with locale formatting', () => {
      render(
        <CreditDeductionToast amount={100} action="Create Menu" newBalance={12345} />
      );

      expect(screen.getByText('12,345 remaining')).toBeInTheDocument();
    });

    it('should show zero balance', () => {
      render(
        <CreditDeductionToast amount={50} action="Order" newBalance={0} />
      );

      expect(screen.getByText('0 remaining')).toBeInTheDocument();
    });
  });

  describe('Auto-dismiss', () => {
    it('should be visible initially', () => {
      render(
        <CreditDeductionToast amount={25} action="Test" newBalance={5000} />
      );

      expect(screen.getByText('-25 credits')).toBeInTheDocument();
    });

    it('should call onDismiss after 3.3 seconds (3s + 300ms fade)', () => {
      const onDismiss = vi.fn();
      render(
        <CreditDeductionToast
          amount={25}
          action="Test"
          newBalance={5000}
          onDismiss={onDismiss}
        />
      );

      // Not dismissed yet at 2.9s
      act(() => {
        vi.advanceTimersByTime(2900);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Should be dismissed after 3.3s (3000ms + 300ms fade)
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not be visible after dismiss', () => {
      render(
        <CreditDeductionToast amount={25} action="Test" newBalance={5000} />
      );

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(screen.queryByText('-25 credits')).not.toBeInTheDocument();
    });
  });

  describe('Color thresholds', () => {
    it('should use default styling for normal balance (>= 1000)', () => {
      const { container } = render(
        <CreditDeductionToast amount={25} action="Test" newBalance={5000} />
      );

      const inner = container.querySelector('.bg-background\\/95');
      expect(inner).toBeInTheDocument();
    });

    it('should use orange styling for low balance (< 1000)', () => {
      const { container } = render(
        <CreditDeductionToast amount={25} action="Test" newBalance={999} />
      );

      const inner = container.querySelector('.bg-orange-500\\/90');
      expect(inner).toBeInTheDocument();
    });

    it('should use red styling for critical balance (< 500)', () => {
      const { container } = render(
        <CreditDeductionToast amount={25} action="Test" newBalance={100} />
      );

      const inner = container.querySelector('.bg-red-500\\/90');
      expect(inner).toBeInTheDocument();
    });

    it('should show "Tap to upgrade" for low balance', () => {
      render(
        <CreditDeductionToast amount={25} action="Test" newBalance={500} />
      );

      expect(screen.getByText(/Tap to upgrade/)).toBeInTheDocument();
    });

    it('should not show "Tap to upgrade" for normal balance', () => {
      render(
        <CreditDeductionToast amount={25} action="Test" newBalance={5000} />
      );

      expect(screen.queryByText(/Tap to upgrade/)).not.toBeInTheDocument();
    });
  });

  describe('Click interaction', () => {
    it('should open CreditPurchaseModal when clicked', () => {
      render(
        <CreditDeductionToast amount={25} action="Test" newBalance={5000} />
      );

      expect(screen.queryByTestId('credit-purchase-modal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('-25 credits'));

      expect(screen.getByTestId('credit-purchase-modal')).toBeInTheDocument();
    });
  });
});

describe('CreditToastManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any existing toasts
    creditToastManager.getToasts().forEach((t) => creditToastManager.dismiss(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add a toast when show() is called', () => {
    creditToastManager.show(25, 'Test Action', 4975);

    const toasts = creditToastManager.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].amount).toBe(25);
    expect(toasts[0].action).toBe('Test Action');
    expect(toasts[0].newBalance).toBe(4975);
  });

  it('should stack multiple toasts', () => {
    creditToastManager.show(25, 'First', 4975);
    creditToastManager.show(50, 'Second', 4925);
    creditToastManager.show(10, 'Third', 4915);

    expect(creditToastManager.getToasts()).toHaveLength(3);
  });

  it('should auto-remove toast after cleanup timeout (3500ms)', () => {
    creditToastManager.show(25, 'Test', 4975);

    expect(creditToastManager.getToasts()).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(creditToastManager.getToasts()).toHaveLength(0);
  });

  it('should dismiss a specific toast by id', () => {
    creditToastManager.show(25, 'Keep', 4975);
    creditToastManager.show(50, 'Remove', 4925);

    const toasts = creditToastManager.getToasts();
    const removeId = toasts.find((t) => t.action === 'Remove')!.id;

    creditToastManager.dismiss(removeId);

    const remaining = creditToastManager.getToasts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].action).toBe('Keep');
  });

  it('should notify listeners on show', () => {
    const listener = vi.fn();
    creditToastManager.subscribe(listener);

    creditToastManager.show(25, 'Test', 4975);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ amount: 25, action: 'Test' }),
      ])
    );
  });

  it('should notify listeners on dismiss', () => {
    const listener = vi.fn();
    creditToastManager.show(25, 'Test', 4975);

    creditToastManager.subscribe(listener);
    const toast = creditToastManager.getToasts()[0];
    creditToastManager.dismiss(toast.id);

    expect(listener).toHaveBeenCalledWith([]);
  });

  it('should unsubscribe listener correctly', () => {
    const listener = vi.fn();
    const unsubscribe = creditToastManager.subscribe(listener);

    unsubscribe();
    creditToastManager.show(25, 'Test', 4975);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('showCreditDeductionToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    creditToastManager.getToasts().forEach((t) => creditToastManager.dismiss(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add a toast via the manager', () => {
    showCreditDeductionToast(100, 'Create Menu', 4900);

    const toasts = creditToastManager.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].amount).toBe(100);
    expect(toasts[0].action).toBe('Create Menu');
    expect(toasts[0].newBalance).toBe(4900);
  });
});

describe('CreditToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    creditToastManager.getToasts().forEach((t) => creditToastManager.dismiss(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render nothing when there are no toasts', () => {
    const { container } = render(<CreditToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('should render toasts when manager has items', () => {
    const { baseElement } = render(<CreditToastContainer />);

    act(() => {
      creditToastManager.show(25, 'Order Created', 4975);
    });

    // The toast is rendered in a portal on document.body
    expect(baseElement.querySelector('[class*="pointer-events-none"]')).toBeInTheDocument();
    expect(screen.getByText('-25 credits')).toBeInTheDocument();
    expect(screen.getByText('(Order Created)')).toBeInTheDocument();
  });

  it('should render multiple stacked toasts', () => {
    render(<CreditToastContainer />);

    act(() => {
      creditToastManager.show(25, 'First Action', 4975);
      creditToastManager.show(50, 'Second Action', 4925);
    });

    expect(screen.getByText('(First Action)')).toBeInTheDocument();
    expect(screen.getByText('(Second Action)')).toBeInTheDocument();
  });

  it('should remove toasts after auto-dismiss', () => {
    render(<CreditToastContainer />);

    act(() => {
      creditToastManager.show(25, 'Temp Action', 4975);
    });

    expect(screen.getByText('(Temp Action)')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('(Temp Action)')).not.toBeInTheDocument();
  });
});
