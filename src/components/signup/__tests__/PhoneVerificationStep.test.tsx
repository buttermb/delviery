/**
 * PhoneVerificationStep Component Tests
 *
 * Verifies:
 * 1. Phone input step renders correctly
 * 2. Phone number formatting
 * 3. Sends verification SMS via edge function
 * 4. OTP input step renders after send
 * 5. OTP verification flow
 * 6. Error handling
 * 7. Cooldown timer
 * 8. Skip option
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneVerificationStep } from '../PhoneVerificationStep';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

interface TestProps {
  onVerified?: (phoneHash: string, phoneNumber: string) => void;
  onSkip?: () => void;
  required?: boolean;
}

const defaultProps: TestProps = {
  onVerified: vi.fn(),
  onSkip: vi.fn(),
};

function renderComponent(props: TestProps = {}) {
  return render(
    <PhoneVerificationStep
      onVerified={props.onVerified ?? defaultProps.onVerified!}
      onSkip={props.onSkip}
      required={props.required}
    />
  );
}

describe('PhoneVerificationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('phone input step', () => {
    it('should render phone input with country code selector', () => {
      renderComponent();
      expect(screen.getByText('Verify Your Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
      expect(screen.getByText('Send Verification Code')).toBeInTheDocument();
    });

    it('should disable send button when phone number is too short', () => {
      renderComponent();
      const sendButton = screen.getByText('Send Verification Code');
      expect(sendButton).toBeDisabled();
    });

    it('should show skip button when not required and onSkip provided', () => {
      renderComponent({ onSkip: vi.fn() });
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    it('should not show skip button when required', () => {
      renderComponent({ required: true, onSkip: vi.fn() });
      expect(screen.queryByText('Skip for now')).not.toBeInTheDocument();
    });

    it('should call onSkip when skip button clicked', async () => {
      const onSkip = vi.fn();
      renderComponent({ onSkip });
      await userEvent.click(screen.getByText('Skip for now'));
      expect(onSkip).toHaveBeenCalled();
    });

    it('should show error for short phone number on submit', async () => {
      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '555');
      // Button should still be disabled since digits < 10
      const sendButton = screen.getByText('Send Verification Code');
      expect(sendButton).toBeDisabled();
    });
  });

  describe('sending verification SMS', () => {
    it('should call send-verification-sms edge function with phone data', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
        error: null,
      });

      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');

      const sendButton = screen.getByText('Send Verification Code');
      await userEvent.click(sendButton);

      expect(mockInvoke).toHaveBeenCalledWith('send-verification-sms', {
        body: {
          phoneNumber: '5551234567',
          countryCode: '+1',
        },
      });
    });

    it('should transition to OTP step on successful send', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
        error: null,
      });

      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByLabelText('Verification code digit 1')).toBeInTheDocument();
      });
    });

    it('should show error when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'This phone number is already associated with an account.' },
        error: null,
      });

      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByText('This phone number is already associated with an account.')).toBeInTheDocument();
      });
    });

    it('should show error when edge function throws', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Network error'),
      });

      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByText('Failed to send verification code. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('OTP verification step', () => {
    async function goToOtpStep() {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
        error: null,
      });

      renderComponent();
      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByLabelText('Verification code digit 1')).toBeInTheDocument();
      });
    }

    it('should render 6 OTP input fields', async () => {
      await goToOtpStep();
      for (let i = 1; i <= 6; i++) {
        expect(screen.getByLabelText(`Verification code digit ${i}`)).toBeInTheDocument();
      }
    });

    it('should show cooldown timer after sending', async () => {
      await goToOtpStep();
      expect(screen.getByText(/Resend code in \d+s/)).toBeInTheDocument();
    });

    it('should show "Use a different number" button', async () => {
      await goToOtpStep();
      expect(screen.getByText('Use a different number')).toBeInTheDocument();
    });

    it('should call verify-phone on complete OTP entry', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { success: true, phoneHash: 'abc123hash' },
          error: null,
        });

      const onVerified = vi.fn();
      render(
        <PhoneVerificationStep onVerified={onVerified} />
      );

      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByLabelText('Verification code digit 1')).toBeInTheDocument();
      });

      // Type each digit
      for (let i = 0; i < 6; i++) {
        const digitInput = screen.getByLabelText(`Verification code digit ${i + 1}`);
        fireEvent.change(digitInput, { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('verify-phone', {
          body: {
            verificationId: 'ver-123',
            code: '123456',
          },
        });
      });
    });

    it('should show error on failed verification', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { error: 'Invalid code', remainingAttempts: 2 },
          error: null,
        });

      render(
        <PhoneVerificationStep onVerified={vi.fn()} />
      );

      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByLabelText('Verification code digit 1')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        const digitInput = screen.getByLabelText(`Verification code digit ${i + 1}`);
        fireEvent.change(digitInput, { target: { value: '1' } });
      }

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });

    it('should show success step after verification', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          data: { success: true, verificationId: 'ver-123', expiresIn: 600 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { success: true, phoneHash: 'abc123hash' },
          error: null,
        });

      const onVerified = vi.fn();
      render(
        <PhoneVerificationStep onVerified={onVerified} />
      );

      const input = screen.getByLabelText('Phone number');
      await userEvent.type(input, '5551234567');
      await userEvent.click(screen.getByText('Send Verification Code'));

      await waitFor(() => {
        expect(screen.getByLabelText('Verification code digit 1')).toBeInTheDocument();
      });

      for (let i = 0; i < 6; i++) {
        const digitInput = screen.getByLabelText(`Verification code digit ${i + 1}`);
        fireEvent.change(digitInput, { target: { value: String(i + 1) } });
      }

      await waitFor(() => {
        expect(screen.getByText('Phone Verified!')).toBeInTheDocument();
      });

      expect(onVerified).toHaveBeenCalledWith('abc123hash', '+15551234567');
    });
  });
});
