import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/errorHandling/typeGuards";

// ============================================================================
// Types
// ============================================================================

interface PasswordStrengthResult {
  isValid: boolean;
  score: number;
  errors: string[];
}

interface ResetRequestParams {
  email: string;
  tenantSlug?: string;
  userType?: "super_admin" | "tenant_admin" | "customer";
}

interface ConfirmResetParams {
  token: string;
  newPassword: string;
}

interface PasswordResetResult {
  success: boolean;
  message: string;
}

interface TokenVerifyResult {
  valid: boolean;
  email?: string;
  error?: string;
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
// Hook Implementation
// ============================================================================

export function usePasswordReset() {
  const [tokenVerification, setTokenVerification] = useState<{
    isVerifying: boolean;
    isValid: boolean;
    email: string | null;
    error: string | null;
  }>({
    isVerifying: false,
    isValid: false,
    email: null,
    error: null,
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const requestResetMutation = useMutation<PasswordResetResult, Error, ResetRequestParams>({
    mutationFn: async ({ email, tenantSlug, userType = "tenant_admin" }) => {
      const response = await apiFetch(`${supabaseUrl}/functions/v1/auth-forgot-password`, {
        method: "POST",
        body: JSON.stringify({ email, tenantSlug, userType }),
        skipAuth: true,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send reset email");
      }

      return {
        success: true,
        message: "If an account exists with that email, a reset link has been sent.",
      };
    },
    onError: (error) => {
      // Only log - never show error toast for password reset requests
      // to avoid revealing whether an email exists in the system
      const errorMessage = getErrorMessage(error);
      logger.warn("Password reset request failed", { error: errorMessage });
    },
  });

  const confirmResetMutation = useMutation<PasswordResetResult, Error, ConfirmResetParams>({
    mutationFn: async ({ token, newPassword }) => {
      const strengthResult = validatePasswordStrength(newPassword);
      if (!strengthResult.isValid) {
        throw new Error(strengthResult.errors[0] || 'Password does not meet requirements');
      }

      const response = await apiFetch(`${supabaseUrl}/functions/v1/auth-reset-password`, {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
        skipAuth: true,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to reset password";

        if (errorMessage.toLowerCase().includes("expired")) {
          throw new Error("This reset link has expired. Please request a new one.");
        }
        if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("not found")) {
          throw new Error("This reset link is invalid. Please request a new one.");
        }
        throw new Error(errorMessage);
      }

      return {
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
      };
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error);
      logger.warn("Password confirm reset failed", { error: errorMessage });
      toast.error("Failed to reset password", { description: errorMessage });
    },
  });

  const verifyToken = async (token: string): Promise<TokenVerifyResult> => {
    setTokenVerification({ isVerifying: true, isValid: false, email: null, error: null });

    try {
      const response = await apiFetch(`${supabaseUrl}/functions/v1/auth-reset-password`, {
        method: "POST",
        body: JSON.stringify({ action: "verify", token }),
        skipAuth: true,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = errorData.error || "Invalid or expired token";
        setTokenVerification({ isVerifying: false, isValid: false, email: null, error });
        return { valid: false, error };
      }

      const data = await response.json();
      setTokenVerification({ isVerifying: false, isValid: true, email: data.email || null, error: null });
      return { valid: true, email: data.email };
    } catch (error) {
      const message = getErrorMessage(error) || "Failed to verify token";
      setTokenVerification({ isVerifying: false, isValid: false, email: null, error: message });
      logger.warn("Token verification failed", { error: message });
      return { valid: false, error: message };
    }
  };

  const requestReset = (params: ResetRequestParams) => {
    return requestResetMutation.mutateAsync(params);
  };

  const confirmReset = (params: ConfirmResetParams) => {
    return confirmResetMutation.mutateAsync(params);
  };

  return {
    requestReset,
    confirmReset,
    verifyToken,
    tokenVerification,
    validatePasswordStrength,
    isRequestingReset: requestResetMutation.isPending,
    requestResetError: requestResetMutation.error,
    isConfirmingReset: confirmResetMutation.isPending,
    confirmResetError: confirmResetMutation.error,
    requestResetSuccess: requestResetMutation.isSuccess,
    confirmResetSuccess: confirmResetMutation.isSuccess,
  };
}
