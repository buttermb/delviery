/**
 * API Client with Automatic Auth Error Handling
 * Wraps fetch with automatic token injection and error handling
 */

import { getCurrentUserType } from "./authHelpers";
import { emitAuthError } from "@/hooks/useAuthError";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeFetch } from "@/utils/safeFetch";
import { safeStorage } from "@/utils/safeStorage";

const getToken = (): string | null => {
  const userType = getCurrentUserType();
  if (userType === "super_admin") {
    return safeStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN);
  } else if (userType === "tenant_admin") {
    return safeStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  } else if (userType === "customer") {
    return safeStorage.getItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
  }
  return null;
};

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Enhanced fetch with automatic auth token injection
 */
export async function apiFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, headers = {}, ...restOptions } = options;

  // Add auth token if not skipped
  const authHeaders: HeadersInit = { ...headers };
  if (!skipAuth) {
    const token = getToken();
    if (token) {
      (authHeaders as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    // Use safeFetch to prevent "illegal invocation" errors
    const response = await safeFetch(url, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    // Handle auth errors - attempt token refresh on 401
    if (response.status === 401) {
      // Try to refresh the token before emitting auth error
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.session?.access_token) {
          // Update stored token
          const userType = getCurrentUserType();
          if (userType === "tenant_admin") {
            safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, refreshData.session.access_token);
            if (refreshData.session.refresh_token) {
              safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, refreshData.session.refresh_token);
            }
          }
          // Retry the request with the new token
          const retryHeaders: Record<string, string> = { ...headers as Record<string, string> };
          retryHeaders["Authorization"] = `Bearer ${refreshData.session.access_token}`;
          const retryResponse = await safeFetch(url, {
            ...restOptions,
            headers: {
              "Content-Type": "application/json",
              ...retryHeaders,
            },
          });
          if (retryResponse.ok) {
            return retryResponse;
          }
        }
      } catch {
        // Refresh failed, fall through to emit auth error
      }
      const error = await response.json().catch(() => ({ message: "Unauthorized" }));
      emitAuthError({
        message: error.error || error.message || "Authentication failed",
        code: "UNAUTHORIZED",
      });
    } else if (response.status === 403) {
      const error = await response.json().catch(() => ({ message: "Forbidden" }));
      emitAuthError({
        message: error.error || error.message || "Access denied",
        code: "FORBIDDEN",
      });
    }

    return response;
  } catch (error: unknown) {
    // Network errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Network")) {
      emitAuthError({
        message: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
      });
    }
    throw error;
  }
}

/**
 * API request helper for Edge Functions
 */
export async function edgeFunctionRequest(
  functionName: string,
  body?: unknown,
  options: FetchOptions = {}
): Promise<unknown> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await apiFetch(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || "Request failed");
  }

  const data = await response.json();

  // Check if response contains an error message (some edge functions return 200 with error in body)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'Request failed';
    const errorObj = new Error(errorMessage);
    
    // Check if it's an auth error
    if (errorMessage.toLowerCase().includes('unauthorized') || 
        errorMessage.toLowerCase().includes('forbidden') ||
        errorMessage.toLowerCase().includes('invalid token') ||
        errorMessage.toLowerCase().includes('missing authorization') ||
        errorMessage.toLowerCase().includes('no token')) {
      errorObj.name = 'AuthError';
      emitAuthError({
        message: errorMessage,
        code: errorMessage.toLowerCase().includes('forbidden') ? 'FORBIDDEN' : 'UNAUTHORIZED',
      });
    }
    
    throw errorObj;
  }

  return data;
}

