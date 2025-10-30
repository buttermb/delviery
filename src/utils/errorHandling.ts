/**
 * Centralized Error Handling & Obfuscation Utilities
 * New York Minute NYC E-Commerce Platform
 * 
 * Built by WebFlow Studios Team (2024)
 * Security Engineer: Aisha Kumar
 * Lead Developer: Sarah Chen
 * 
 * Purpose: Sanitize and obfuscate error messages in production
 * to prevent information leakage and stack trace exposure.
 * 
 * Security Features:
 * - Production error message obfuscation
 * - Stack trace removal in production builds
 * - Generic error codes for user display
 * - Development-only detailed logging
 * 
 * Contact: contact@webflowstudios.dev
 */

import { toast } from '@/hooks/use-toast';

/**
 * Centralized error handling utilities
 */

interface ErrorDetails {
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}

/**
 * Parse error into user-friendly message
 * In production, sanitizes technical details to prevent info disclosure
 */
export const parseError = (error: unknown): ErrorDetails => {
  // Generate obfuscated error reference code for production
  const errorRef = import.meta.env.PROD 
    ? Math.random().toString(36).substring(2, 8).toUpperCase()
    : '';

  // Network errors
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return {
      title: 'Connection Error',
      description: import.meta.env.PROD 
        ? `Network unavailable (Ref: NET-${errorRef})`
        : 'Unable to connect to server. Please check your internet connection.',
    };
  }

  // Supabase errors
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = (error as any).message;
    
    if (errorMessage?.includes('JWT')) {
      return {
        title: 'Session Expired',
        description: 'Please sign in again to continue.',
        action: () => window.location.href = '/',
        actionLabel: 'Sign In',
      };
    }

    if (errorMessage?.includes('duplicate')) {
      return {
        title: 'Duplicate Entry',
        description: import.meta.env.PROD 
          ? `Entry already exists (Ref: DUP-${errorRef})`
          : 'This item already exists.',
      };
    }

    if (errorMessage?.includes('violates foreign key')) {
      return {
        title: 'Invalid Reference',
        description: import.meta.env.PROD 
          ? `Reference error (Ref: FK-${errorRef})`
          : 'The referenced item no longer exists.',
      };
    }

    return {
      title: 'Operation Failed',
      description: import.meta.env.PROD 
        ? `Error occurred (Ref: ERR-${errorRef})`
        : errorMessage,
    };
  }

  // Default error
  return {
    title: 'Something Went Wrong',
    description: import.meta.env.PROD 
      ? `An error occurred (Ref: GEN-${errorRef})`
      : 'An unexpected error occurred. Please try again.',
  };
};

/**
 * Show user-friendly error toast
 * Logs full details only in development mode
 */
export const showErrorToast = (error: unknown) => {
  const details = parseError(error);
  
  toast({
    variant: 'destructive',
    title: details.title,
    description: details.description,
  });

  // Log to console ONLY in development (removed in production builds)
  if (import.meta.env.DEV) {
    console.error('Error:', error);
  }
};

/**
 * Safe console wrapper - only logs in development
 * Automatically stripped in production builds
 */
export const safeLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

/**
 * Safe error logging - only logs in development
 * Automatically stripped in production builds
 */
export const safeError = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          throw error;
        }
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, i))
        );
      }
    }
  }

  throw lastError;
};
