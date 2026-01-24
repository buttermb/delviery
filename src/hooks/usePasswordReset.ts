import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils/apiClient";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/utils/errorHandling/typeGuards";

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
      logger.warn("Password reset request failed", { error: getErrorMessage(error) });
    },
  });

  const confirmResetMutation = useMutation<PasswordResetResult, Error, ConfirmResetParams>({
    mutationFn: async ({ token, newPassword }) => {
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
      logger.warn("Password confirm reset failed", { error: getErrorMessage(error) });
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
    isRequestingReset: requestResetMutation.isPending,
    requestResetError: requestResetMutation.error,
    isConfirmingReset: confirmResetMutation.isPending,
    confirmResetError: confirmResetMutation.error,
    requestResetSuccess: requestResetMutation.isSuccess,
    confirmResetSuccess: confirmResetMutation.isSuccess,
  };
}
