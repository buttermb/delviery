/**
 * Network Resilience Utilities
 * Provides retry logic, error categorization, connection status, and offline detection
 */

import { logger } from '@/lib/logger';

// Bound fetch to prevent "Illegal invocation" error in production builds
export const safeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

/**
 * Error categories for better error handling
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',           // Network connectivity issues
  AUTH = 'AUTH',                 // Authentication/authorization errors
  VALIDATION = 'VALIDATION',      // Input validation errors
  SERVER = 'SERVER',             // Server-side errors (5xx)
  CLIENT = 'CLIENT',             // Client-side errors (4xx)
  TIMEOUT = 'TIMEOUT',           // Request timeout
  UNKNOWN = 'UNKNOWN',           // Unknown errors
}

/**
 * Categorize an error based on its properties
 */
export function categorizeError(error: unknown, response?: Response): ErrorCategory {
  // Network errors (no response)
  if (!response) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return ErrorCategory.NETWORK;
    }
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
      return ErrorCategory.TIMEOUT;
    }
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return ErrorCategory.NETWORK;
    }
    return ErrorCategory.NETWORK;
  }

  // HTTP status code errors
  const status = response.status;
  
  if (status === 401 || status === 403) {
    return ErrorCategory.AUTH;
  }
  
  if (status === 400 || status === 422) {
    return ErrorCategory.VALIDATION;
  }
  
  if (status >= 500) {
    return ErrorCategory.SERVER;
  }
  
  if (status >= 400) {
    return ErrorCategory.CLIENT;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly error message based on category
 */
export function getErrorMessage(category: ErrorCategory, originalError?: unknown): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Network error. Please check your internet connection and try again.';
    case ErrorCategory.AUTH:
      return 'Authentication failed. Please check your credentials and try again.';
    case ErrorCategory.VALIDATION:
      return 'Invalid input. Please check your information and try again.';
    case ErrorCategory.SERVER:
      return 'Server error. Please try again in a moment.';
    case ErrorCategory.TIMEOUT:
      return 'Request timed out. Please check your connection and try again.';
    case ErrorCategory.CLIENT:
      return 'Request failed. Please try again.';
    default:
      if (originalError instanceof Error) {
        return originalError.message || 'An unexpected error occurred.';
      }
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  retryableCategories?: ErrorCategory[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableCategories: [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT, ErrorCategory.SERVER],
};

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if error is retryable
 */
function isRetryable(
  category: ErrorCategory,
  status?: number,
  config: Required<RetryConfig>
): boolean {
  // Check if category is retryable
  if (config.retryableCategories.includes(category)) {
    return true;
  }
  
  // Check if status code is retryable
  if (status && config.retryableStatuses.includes(status)) {
    return true;
  }
  
  return false;
}

/**
 * Enhanced fetch with retry logic and error categorization
 */
export interface ResilientFetchOptions extends RequestInit {
  retryConfig?: RetryConfig;
  timeout?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  onError?: (category: ErrorCategory, error: unknown) => void;
}

export interface ResilientFetchResult {
  response: Response;
  attempts: number;
  category: ErrorCategory;
}

/**
 * Fetch with automatic retry and error handling
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<ResilientFetchResult> {
  const {
    retryConfig = {},
    timeout = 30000, // 30 seconds default
    onRetry,
    onError,
    ...fetchOptions
  } = options;

  const config: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig,
  };

  let lastError: unknown;
  let lastResponse: Response | undefined;
  let attempts = 0;
  let currentTimeoutId: NodeJS.Timeout | null = null;

  try {
    while (attempts <= config.maxRetries) {
      attempts++;
      
      // Create abort controller for this attempt
      const controller = new AbortController();
      if (timeout > 0) {
        currentTimeoutId = setTimeout(() => controller.abort(), timeout);
      }
      
      try {
        logger.debug('Network request attempt', {
          url,
          attempt: attempts,
          maxRetries: config.maxRetries,
        });

        const response = await safeFetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        // Clear timeout if request succeeded
        if (currentTimeoutId) {
          clearTimeout(currentTimeoutId);
          currentTimeoutId = null;
        }

        lastResponse = response;

        // If response is successful, return it
        if (response.ok) {
          const category = categorizeError(null, response);
          return {
            response,
            attempts,
            category,
          };
        }

        // Check if error is retryable
        const category = categorizeError(null, response);
        if (!isRetryable(category, response.status, config)) {
          // Not retryable, return error response
          if (onError) {
            onError(category, new Error(`HTTP ${response.status}: ${response.statusText}`));
          }
          return {
            response,
            attempts,
            category,
          };
        }

        // Retryable error - prepare for retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        if (attempts <= config.maxRetries) {
          const delay = calculateDelay(attempts - 1, config);
          
          if (onRetry) {
            onRetry(attempts, lastError);
          }
          
          logger.warn('Retrying network request', {
            url,
            attempt: attempts,
            delay,
            status: response.status,
            category,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: unknown) {
        lastError = error;
        
        // Clear timeout on error
        if (currentTimeoutId) {
          clearTimeout(currentTimeoutId);
          currentTimeoutId = null;
        }

        const category = categorizeError(error);
        
        // Check if error is retryable
        if (!isRetryable(category, undefined, config) || attempts > config.maxRetries) {
          if (onError) {
            onError(category, error);
          }
          
          // Create a mock response for network errors
          const mockResponse = new Response(
            JSON.stringify({ 
              error: getErrorMessage(category, error),
              category 
            }),
            {
              status: category === ErrorCategory.NETWORK ? 0 : 500,
              statusText: getErrorMessage(category, error),
            }
          );
          
          return {
            response: mockResponse,
            attempts,
            category,
          };
        }

        // Retryable error - prepare for retry
        if (attempts <= config.maxRetries) {
          const delay = calculateDelay(attempts - 1, config);
          
          if (onRetry) {
            onRetry(attempts, error);
          }
          
          logger.warn('Retrying network request after error', {
            url,
            attempt: attempts,
            delay,
            category,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const category = categorizeError(lastError, lastResponse);
    if (onError) {
      onError(category, lastError);
    }

    const mockResponse = new Response(
      JSON.stringify({ 
        error: getErrorMessage(category, lastError),
        category 
      }),
      {
        status: lastResponse?.status || 500,
        statusText: getErrorMessage(category, lastError),
      }
    );

    return {
      response: mockResponse,
      attempts,
      category,
    };
  } finally {
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
    }
  }
}

/**
 * Connection status monitoring
 */
export type ConnectionStatus = 'online' | 'offline' | 'slow' | 'unknown';

let connectionStatus: ConnectionStatus = 'unknown';
let connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();

/**
 * Get current connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine ? 'online' : 'offline';
  }
  return connectionStatus;
}

/**
 * Subscribe to connection status changes
 */
export function onConnectionStatusChange(callback: (status: ConnectionStatus) => void): () => void {
  connectionListeners.add(callback);
  
  // Call immediately with current status
  callback(getConnectionStatus());
  
  // Return unsubscribe function
  return () => {
    connectionListeners.delete(callback);
  };
}

/**
 * Initialize connection status monitoring
 */
export function initConnectionMonitoring(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Monitor online/offline events
  const updateStatus = () => {
    const newStatus: ConnectionStatus = navigator.onLine ? 'online' : 'offline';
    
    if (newStatus !== connectionStatus) {
      connectionStatus = newStatus;
      connectionListeners.forEach(listener => listener(newStatus));
      
      logger.info('Connection status changed', {
        status: newStatus,
        previousStatus: connectionStatus,
      });
    }
  };

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  
  // Initial status
  updateStatus();
}

/**
 * Check if currently offline
 */
export function isOffline(): boolean {
  return getConnectionStatus() === 'offline';
}

