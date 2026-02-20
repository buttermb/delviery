import { logger } from '@/lib/logger';
/**
 * Admin Function Helper
 * Centralized error handling for admin edge function calls
 */

import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import bugFinder from './bugFinder';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { humanizeError } from '@/lib/humanizeError';

interface FunctionCallOptions {
  functionName: string;
  body?: Record<string, unknown>;
  session?: Session | null;
  errorMessage?: string;
  showToast?: boolean;
}

export async function callAdminFunction<T = unknown>({
  functionName,
  body = {},
  session,
  errorMessage = 'Failed to perform action',
  showToast = true,
}: FunctionCallOptions): Promise<{ data: T | null; error: Error | null }> {
  try {
    const headers: Record<string, string> = {};

    // Get current session from Supabase auth
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // Add authorization header - prefer provided session, then current session
    const accessToken = session?.access_token || currentSession?.access_token;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else {
      // Try to get from localStorage as fallback
      const storedToken = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
      if (storedToken) {
        headers.Authorization = `Bearer ${storedToken}`;
      }
    }

    if (!headers.Authorization) {
      logger.warn('No access token available for Edge Function call', { functionName, component: 'adminFunctionHelper' });
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers,
    });

    if (error) {
      logger.error(`Error calling ${functionName}`, error, { component: 'adminFunctionHelper' });

      // Report to bug finder
      bugFinder.reportEdgeFunctionError(
        functionName,
        error,
        { body, errorType: 'invoke_error' }
      );

      if (showToast) {
        toast.error(errorMessage, {
          description: humanizeError(error, 'Please try again later'),
        });
      }

      return { data: null, error };
    }

    // Check if response contains an error message (some edge functions return 200 with error in body)
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      const errorMessage = typeof data.error === 'string' ? data.error : 'Operation failed';
      const errorObj = new Error(errorMessage);

      // Check if it's an auth error
      if (errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('forbidden') ||
        errorMessage.toLowerCase().includes('invalid token') ||
        errorMessage.toLowerCase().includes('missing authorization') ||
        errorMessage.toLowerCase().includes('no token')) {
        errorObj.name = 'AuthError';
        logger.error(`Auth error in ${functionName} response`, errorObj, { component: 'adminFunctionHelper' });
      } else {
        logger.error(`Error in ${functionName} response`, errorObj, { component: 'adminFunctionHelper' });
      }

      bugFinder.reportEdgeFunctionError(
        functionName,
        errorObj,
        { body, response: data, errorType: 'response_error' }
      );

      if (showToast) {
        toast.error(errorMessage, {
          description: 'Please check your authentication and try again',
        });
      }

      return { data: null, error: errorObj };
    }

    return { data: data as T, error: null };
  } catch (error: unknown) {
    logger.error(`Exception calling ${functionName}`, error, { component: 'adminFunctionHelper' });

    // Report to bug finder
    const errorObj = error instanceof Error ? error : new Error(String(error));
    bugFinder.reportEdgeFunctionError(
      functionName,
      errorObj,
      { body, errorType: 'exception' }
    );

    if (showToast) {
      toast.error(errorMessage, {
        description: humanizeError(errorObj, 'An unexpected error occurred'),
      });
    }

    return { data: null, error: errorObj };
  }
}

// Specific helper for admin dashboard calls
export async function getAdminDashboardData(
  endpoint: string,
  session: Session | null,
  additionalParams?: Record<string, unknown>
) {
  return callAdminFunction({
    functionName: 'admin-dashboard',
    body: { endpoint, ...additionalParams },
    session,
    errorMessage: `Failed to load ${endpoint} data`,
  });
}

// Helper for order status updates
export async function updateOrderStatusFunction(
  orderId: string,
  status: string,
  session: Session | null
) {
  return callAdminFunction({
    functionName: 'update-order-status',
    body: { orderId, status, message: `Status updated to ${status.replace(/_/g, ' ')}` },
    session,
    errorMessage: 'Failed to update order status',
  });
}

// Helper for risk assessment
export async function assessUserRisk(userId: string, session: Session | null) {
  return callAdminFunction({
    functionName: 'assess-risk',
    body: { userId },
    session,
    errorMessage: 'Failed to assess user risk',
    showToast: false, // Don't show toast for background operations
  });
}

// Helper with retry logic
export async function callAdminFunctionWithRetry<T = unknown>(
  options: FunctionCallOptions,
  maxRetries: number = 2
): Promise<{ data: T | null; error: Error | null }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await callAdminFunction<T>(options);

    if (!error) {
      return { data, error: null };
    }

    lastError = error;

    // Don't retry on certain errors
    if (error.message?.includes('Unauthorized') || error.message?.includes('403')) {
      break;
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return { data: null, error: lastError };
}
