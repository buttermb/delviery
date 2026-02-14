/**
 * Safe Fetch Wrapper
 * 
 * Provides a properly bound fetch function that prevents "illegal invocation" errors
 * when fetch is wrapped or proxied by external scripts (like Lovable preview script).
 * 
 * Usage:
 * import { safeFetch } from '@/utils/safeFetch';
 * const response = await safeFetch('https://api.example.com/data');
 */

/**
 * Safely bound fetch function that prevents illegal invocation errors
 */
export const safeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  // Ensure fetch is properly bound to window context
  const boundFetch = typeof window !== 'undefined' 
    ? window.fetch.bind(window) 
    : fetch;
  
  return boundFetch(input, init);
};

/**
 * Type-safe fetch wrapper with automatic error handling
 */
export const safeFetchJSON = async <T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const response = await safeFetch(input, init);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};
