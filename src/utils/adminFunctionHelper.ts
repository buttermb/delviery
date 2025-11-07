/**
 * Admin Function Helper
 * Centralized error handling for admin edge function calls
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import bugFinder from './bugFinder';
import { logger } from './logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface FunctionCallOptions {
  functionName: string;
  body?: Record<string, any>;
  session?: any;
  errorMessage?: string;
  showToast?: boolean;
}

export async function callAdminFunction<T = any>({
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
      logger.warn('No access token available for Edge Function call', { functionName }, 'adminFunctionHelper');
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers,
    });

    if (error) {
      logger.error(`Error calling ${functionName}`, error, 'adminFunctionHelper');
      
      // Report to bug finder
      bugFinder.reportEdgeFunctionError(
        functionName,
        error,
        { body, errorType: 'invoke_error' }
      );
      
      if (showToast) {
        toast.error(errorMessage, {
          description: error.message || 'Please try again later',
        });
      }
      
      return { data: null, error };
    }

    return { data: data as T, error: null };
  } catch (error: any) {
    logger.error(`Exception calling ${functionName}`, error, 'adminFunctionHelper');
    
    // Report to bug finder
    const errorObj = error instanceof Error ? error : new Error(String(error));
    bugFinder.reportEdgeFunctionError(
      functionName,
      errorObj,
      { body, errorType: 'exception' }
    );
    
    if (showToast) {
      toast.error(errorMessage, {
        description: error.message || 'An unexpected error occurred',
      });
    }
    
    return { data: null, error };
  }
}

// Specific helper for admin dashboard calls
export async function getAdminDashboardData(
  endpoint: string,
  session: any,
  additionalParams?: Record<string, any>
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
  session: any
) {
  return callAdminFunction({
    functionName: 'update-order-status',
    body: { orderId, status, message: `Status updated to ${status.replace(/_/g, ' ')}` },
    session,
    errorMessage: 'Failed to update order status',
  });
}

// Helper for risk assessment
export async function assessUserRisk(userId: string, session: any) {
  return callAdminFunction({
    functionName: 'assess-risk',
    body: { userId },
    session,
    errorMessage: 'Failed to assess user risk',
    showToast: false, // Don't show toast for background operations
  });
}

// Helper with retry logic
export async function callAdminFunctionWithRetry<T = any>(
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
