/**
 * Password Reset Utilities
 * For all three authentication tiers
 */

import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/utils/apiClient";

/**
 * Request password reset for super admin
 */
export async function requestSuperAdminPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await apiFetch(`${supabaseUrl}/functions/v1/password-reset`, {
      method: "POST",
      body: JSON.stringify({
        userType: "super_admin",
        email,
      }),
      skipAuth: true,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send reset email");
    }

    return {
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to request password reset",
    };
  }
}

/**
 * Request password reset for tenant admin
 */
export async function requestTenantAdminPasswordReset(
  email: string,
  tenantSlug: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await apiFetch(`${supabaseUrl}/functions/v1/password-reset`, {
      method: "POST",
      body: JSON.stringify({
        userType: "tenant_admin",
        email,
        tenantSlug,
      }),
      skipAuth: true,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send reset email");
    }

    return {
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to request password reset",
    };
  }
}

/**
 * Request password reset for customer
 */
export async function requestCustomerPasswordReset(
  email: string,
  tenantSlug: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await apiFetch(`${supabaseUrl}/functions/v1/password-reset`, {
      method: "POST",
      body: JSON.stringify({
        userType: "customer",
        email,
        tenantSlug,
      }),
      skipAuth: true,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send reset email");
    }

    return {
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to request password reset",
    };
  }
}

/**
 * Reset password with token
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
  userType: "super_admin" | "tenant_admin" | "customer"
): Promise<{ success: boolean; message: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await apiFetch(`${supabaseUrl}/functions/v1/password-reset`, {
      method: "POST",
      body: JSON.stringify({
        action: "reset",
        token,
        newPassword,
        userType,
      }),
      skipAuth: true,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to reset password");
    }

    return {
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to reset password",
    };
  }
}

/**
 * Verify reset token is valid
 */
export async function verifyResetToken(
  token: string,
  userType: "super_admin" | "tenant_admin" | "customer"
): Promise<{ valid: boolean; email?: string; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await apiFetch(`${supabaseUrl}/functions/v1/password-reset`, {
      method: "POST",
      body: JSON.stringify({
        action: "verify",
        token,
        userType,
      }),
      skipAuth: true,
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        valid: false,
        error: error.error || "Invalid or expired token",
      };
    }

    const data = await response.json();
    return {
      valid: true,
      email: data.email,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Failed to verify token",
    };
  }
}

