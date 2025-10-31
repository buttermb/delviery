/**
 * Helper for calling Supabase Edge Functions with automatic error tracking
 */

import { supabase } from '@/integrations/supabase/client';
import bugFinder from './bugFinder';

export interface EdgeFunctionOptions {
  functionName: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

/**
 * Invoke Supabase Edge Function with automatic error tracking
 */
export async function invokeEdgeFunction<T = any>(
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

