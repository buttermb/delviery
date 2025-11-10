/**
 * API Client with Automatic Auth Error Handling
 * Wraps fetch with automatic token injection and error handling
 */

import { getCurrentUserType } from "./authHelpers";
import { emitAuthError } from "@/hooks/useAuthError";
import { STORAGE_KEYS } from "@/constants/storageKeys";

const getToken = (): string | null => {
  const userType = getCurrentUserType();
  if (userType === "super_admin") {
    return localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN);
  } else if (userType === "tenant_admin") {
    return localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  } else if (userType === "customer") {
    return localStorage.getItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
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
    // Bind fetch to window to prevent "illegal invocation" errors in mobile browsers
    const boundFetch = fetch.bind(window);
    const response = await boundFetch(url, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      const error = await response.json().catch(() => ({ message: "Unauthorized" }));
      emitAuthError({
        message: error.error || error.message || "Authentication failed",
        code: response.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      });
    }

    return response;
  } catch (error: any) {
    // Network errors
    if (error.message?.includes("Failed to fetch") || error.message?.includes("Network")) {
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
  body?: any,
  options: FetchOptions = {}
): Promise<any> {
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

  return response.json();
}

