/**
 * Helper for calling Supabase Edge Functions with automatic error tracking
 */

import { supabase } from '@/integrations/supabase/client';
import bugFinder from './bugFinder';

export interface EdgeFunctionOptions {
  functionName: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Invoke Supabase Edge Function with automatic error tracking
 */
export async function invokeEdgeFunction<T = unknown>(
  options: EdgeFunctionOptions
): Promise<{ data: T | null; error: Error | null }> {
  const { functionName, body, headers } = options;

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers,
    });

    if (error) {
      // Report edge function error to bug finder
      bugFinder.reportEdgeFunctionError(
        functionName,
        error,
        { body, response: data }
      );

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
      }
      
      bugFinder.reportEdgeFunctionError(
        functionName,
        errorObj,
        { body, response: data, errorType: 'response_error' }
      );

      return { data: null, error: errorObj };
    }

    return { data: data as T, error: null };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    // Report edge function error to bug finder
    bugFinder.reportEdgeFunctionError(
      functionName,
      errorObj,
      { body, errorType: 'exception' }
    );

    return { data: null, error: errorObj };
  }
}

