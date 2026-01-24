/**
 * Password Reset Hook
 * Provides requestReset and confirmReset mutations for the forgot password flow.
 * Uses TanStack Query useMutation for state management.
 */

import { useMutation } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import {
  requestSuperAdminPasswordReset,
  requestTenantAdminPasswordReset,
  requestCustomerPasswordReset,
  resetPasswordWithToken,
} from "@/utils/passwordReset";

type UserType = "super_admin" | "tenant_admin" | "customer";

interface RequestResetParams {
  email: string;
  userType?: UserType;
  tenantSlug?: string;
}

interface ConfirmResetParams {
  token: string;
  newPassword: string;
  userType: UserType;
}

interface ResetResult {
  success: boolean;
  message: string;
}

export function usePasswordReset() {
  const requestReset = useMutation<ResetResult, Error, RequestResetParams>({
    mutationFn: async ({ email, userType = "tenant_admin", tenantSlug }) => {
      logger.debug("Requesting password reset", { email, userType });

      let result: ResetResult;

      if (userType === "super_admin") {
        result = await requestSuperAdminPasswordReset(email);
      } else if (userType === "tenant_admin") {
        if (!tenantSlug) {
          return { success: false, message: "Tenant context is required" };
        }
        result = await requestTenantAdminPasswordReset(email, tenantSlug);
      } else {
        if (!tenantSlug) {
          return { success: false, message: "Tenant context is required" };
        }
        result = await requestCustomerPasswordReset(email, tenantSlug);
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    onError: (error) => {
      logger.error("Password reset request failed", error);
    },
  });

  const confirmReset = useMutation<ResetResult, Error, ConfirmResetParams>({
    mutationFn: async ({ token, newPassword, userType }) => {
      logger.debug("Confirming password reset", { userType });

      const result = await resetPasswordWithToken(token, newPassword, userType);

      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    onError: (error) => {
      logger.error("Password reset confirmation failed", error);
    },
  });

  return {
    requestReset,
    confirmReset,
  };
}
