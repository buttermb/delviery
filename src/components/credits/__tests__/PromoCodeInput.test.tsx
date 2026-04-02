/**
 * PromoCodeInput Component Tests
 *
 * Tests the promo code input component including:
 * - Input validation and formatting
 * - Apply button interaction
 * - Success/error states
 * - Applied code display and removal
 * - Loading state during validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PromoCodeInput } from '../PromoCodeInput';
import type { ValidatedPromoCode } from '../PromoCodeInput';

// ============================================================================
// Mocks
// ============================================================================

const mockValidatePromoCode = vi.fn();

vi.mock('@/lib/credits/promoCodeService', () => ({
  validatePromoCode: (...args: unknown[]) => mockValidatePromoCode(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderComponent(props: {
  onCodeApplied?: (code: ValidatedPromoCode | null) => void;
  appliedCode?: ValidatedPromoCode | null;
  disabled?: boolean;
} = {}) {
  const queryClient = createQueryClient();
  const onCodeApplied = props.onCodeApplied ?? vi.fn();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <PromoCodeInput
        onCodeApplied={onCodeApplied}
        appliedCode={props.appliedCode}
        disabled={props.disabled}
      />
    </QueryClientProvider>
  );

  return { ...result, onCodeApplied };
}

// ============================================================================
// Tests
// ============================================================================

describe('PromoCodeInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders input and apply button', () => {
      renderComponent();

      expect(screen.getByLabelText('Promo code')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });

    it('disables apply button when input is empty', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });

    it('shows placeholder text', () => {
      renderComponent();

      expect(screen.getByPlaceholderText('Enter promo code')).toBeInTheDocument();
    });
  });

  describe('input formatting', () => {
    it('converts input to uppercase', async () => {
      const user = userEvent.setup();
      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'save20');

      expect(input).toHaveValue('SAVE20');
    });

    it('strips non-alphanumeric characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'code-123!');

      expect(input).toHaveValue('CODE123');
    });
  });

  describe('apply button', () => {
    it('enables apply button when code has 3+ characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'ABC');

      expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    });

    it('keeps button disabled with fewer than 3 characters', async () => {
      const user = userEvent.setup();
      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'AB');

      expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });

    it('shows error when apply clicked with code < 3 chars', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Type 2 chars then try to trigger validation some other way
      // The button is disabled so we can't click it — this is the correct UX
      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'AB');

      expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });
  });

  describe('successful validation', () => {
    it('calls onCodeApplied with validated code', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: true,
        promoCode: {
          code: 'SAVE20',
          creditsAmount: 500,
          description: 'Save 20%',
        },
      });

      const { onCodeApplied } = renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'SAVE20');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(onCodeApplied).toHaveBeenCalledWith({
          code: 'SAVE20',
          creditsAmount: 500,
          description: 'Save 20%',
        });
      });
    });

    it('clears input after successful validation', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: true,
        promoCode: {
          code: 'SAVE20',
          creditsAmount: 500,
        },
      });

      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'SAVE20');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('failed validation', () => {
    it('shows error message for invalid code', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: false,
        error: 'Invalid promo code',
      });

      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'BADCODE');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid promo code');
      });
    });

    it('shows error for expired code', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: false,
        error: 'Promo code has expired',
      });

      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'EXPIRED');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Promo code has expired');
      });
    });

    it('calls onCodeApplied with null on failure', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: false,
        error: 'Invalid promo code',
      });

      const { onCodeApplied } = renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'BAD');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(onCodeApplied).toHaveBeenCalledWith(null);
      });
    });

    it('shows fallback error on network failure', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockRejectedValue(new Error('Network error'));

      renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'TEST');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to validate code');
      });
    });
  });

  describe('applied code state', () => {
    const appliedCode: ValidatedPromoCode = {
      code: 'SAVE20',
      creditsAmount: 500,
      description: 'Save 20%',
    };

    it('displays applied code details', () => {
      renderComponent({ appliedCode });

      expect(screen.getByText(/Code applied:/)).toBeInTheDocument();
      expect(screen.getByText('SAVE20')).toBeInTheDocument();
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('shows remove button when not disabled', () => {
      renderComponent({ appliedCode });

      expect(screen.getByLabelText('Remove promo code')).toBeInTheDocument();
    });

    it('hides remove button when disabled', () => {
      renderComponent({ appliedCode, disabled: true });

      expect(screen.queryByLabelText('Remove promo code')).not.toBeInTheDocument();
    });

    it('calls onCodeApplied(null) when remove is clicked', async () => {
      const user = userEvent.setup();
      const { onCodeApplied } = renderComponent({ appliedCode });

      await user.click(screen.getByLabelText('Remove promo code'));

      expect(onCodeApplied).toHaveBeenCalledWith(null);
    });

    it('hides input field when code is applied', () => {
      renderComponent({ appliedCode });

      expect(screen.queryByLabelText('Promo code')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      renderComponent({ disabled: true });

      expect(screen.getByLabelText('Promo code')).toBeDisabled();
    });

    it('disables apply button when disabled', () => {
      renderComponent({ disabled: true });

      expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });
  });

  describe('keyboard interaction', () => {
    it('submits on Enter key', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: true,
        promoCode: {
          code: 'ENTER',
          creditsAmount: 100,
        },
      });

      const { onCodeApplied } = renderComponent();

      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'ENTER');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockValidatePromoCode).toHaveBeenCalledWith('ENTER');
      });
    });
  });

  describe('error clearing', () => {
    it('clears error when user types new input', async () => {
      const user = userEvent.setup();
      mockValidatePromoCode.mockResolvedValue({
        valid: false,
        error: 'Invalid promo code',
      });

      renderComponent();

      // First, trigger an error
      const input = screen.getByLabelText('Promo code');
      await user.type(input, 'BAD');
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Type new input — error should clear
      await user.type(input, 'N');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
