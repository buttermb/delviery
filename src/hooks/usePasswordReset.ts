import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// ============================================================================
// Types
// ============================================================================

interface PasswordStrengthResult {
  isValid: boolean;
  score: number;
  errors: string[];
}

interface RequestResetParams {
  email: string;
}

interface ConfirmResetParams {
  token: string;
  newPassword: string;
}

interface PasswordResetResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// Password Strength Validation
// ============================================================================

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  let score = 0;

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  } else {
    score += 1;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be no more than ${MAX_PASSWORD_LENGTH} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    score,
    errors,
  };
}

// ============================================================================
// Error Message Mapping
// ============================================================================

function getRequestResetErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Too many reset requests. Please wait a few minutes before trying again.';
    }
    if (msg.includes('not found') || msg.includes('no user')) {
      // Don't reveal whether the email exists for security
      return 'If an account with that email exists, a reset link has been sent.';
    }
    if (msg.includes('invalid email') || msg.includes('email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
  }
  return 'Unable to process your request. Please try again later.';
}

function getConfirmResetErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('expired') || msg.includes('token expired')) {
      return 'This reset link has expired. Please request a new password reset.';
    }
    if (msg.includes('invalid') && msg.includes('token')) {
      return 'This reset link is invalid or has already been used. Please request a new one.';
    }
    if (msg.includes('same password') || msg.includes('same_password')) {
      return 'New password cannot be the same as your current password.';
    }
    if (msg.includes('weak') || msg.includes('strength')) {
      return 'Password does not meet strength requirements.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
  }
  return 'Unable to reset your password. Please try again or request a new reset link.';
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePasswordReset() {
  const requestResetMutation = useMutation<PasswordResetResponse, Error, RequestResetParams>({
    mutationFn: async ({ email }: RequestResetParams): Promise<PasswordResetResponse> => {
      const { data, error } = await supabase.functions.invoke('auth-forgot-password', {
        body: { email },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send reset email');
      }

      return data as PasswordResetResponse;
    },
    onSuccess: () => {
      showSuccessToast(
        'Reset link sent',
        'If an account with that email exists, you will receive a password reset link.'
      );
    },
    onError: (error: Error) => {
      const message = getRequestResetErrorMessage(error);
      logger.error('Password reset request failed', { error: error.message });
      showErrorToast('Reset request failed', message);
    },
  });

  const confirmResetMutation = useMutation<PasswordResetResponse, Error, ConfirmResetParams>({
    mutationFn: async ({ token, newPassword }: ConfirmResetParams): Promise<PasswordResetResponse> => {
      const strengthResult = validatePasswordStrength(newPassword);
      if (!strengthResult.isValid) {
        throw new Error(strengthResult.errors[0] || 'Password does not meet requirements');
      }

      const { data, error } = await supabase.functions.invoke('auth-reset-password', {
        body: { token, newPassword },
      });

      if (error) {
        throw new Error(error.message || 'Failed to reset password');
      }

      return data as PasswordResetResponse;
    },
    onSuccess: () => {
      showSuccessToast(
        'Password reset successful',
        'Your password has been updated. You can now log in with your new password.'
      );
    },
    onError: (error: Error) => {
      const message = getConfirmResetErrorMessage(error);
      logger.error('Password reset confirmation failed', { error: error.message });
      showErrorToast('Password reset failed', message);
    },
  });

  return {
    // Request reset
    requestReset: requestResetMutation.mutate,
    requestResetAsync: requestResetMutation.mutateAsync,
    isRequestingReset: requestResetMutation.isPending,
    requestResetError: requestResetMutation.error,

    // Confirm reset
    confirmReset: confirmResetMutation.mutate,
    confirmResetAsync: confirmResetMutation.mutateAsync,
    isConfirmingReset: confirmResetMutation.isPending,
    confirmResetError: confirmResetMutation.error,

    // Password validation
    validatePasswordStrength,

    // Reset states
    resetRequestState: requestResetMutation.reset,
    resetConfirmState: confirmResetMutation.reset,
  };
}
