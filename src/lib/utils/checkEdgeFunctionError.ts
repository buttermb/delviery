/**
 * Utility to check for errors in edge function responses
 * Some edge functions return 200 status with { error: '...' } in the body
 */

export function checkEdgeFunctionError<T = unknown>(
  data: T | null,
  functionName?: string
): Error | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if ('error' in data && data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : 'Operation failed';
    const errorObj = new Error(errorMessage);
    
    // Check if it's an auth error
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('invalid token') ||
        lowerMessage.includes('missing authorization') ||
        lowerMessage.includes('no token') ||
        lowerMessage.includes('expired token')) {
      errorObj.name = 'AuthError';
    }
    
    return errorObj;
  }

  return null;
}

