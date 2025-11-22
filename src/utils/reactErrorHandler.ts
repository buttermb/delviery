import { logger } from '@/lib/logger';
/**
 * React Error Handler Utilities
 * Provides centralized error handling for React components
 */

import { toast } from 'sonner';
import { logger } from './logger';

export const handleComponentError = (error: Error, errorInfo?: React.ErrorInfo) => {
  // Log error
  logger.error('Component Error', error, { component: 'reactErrorHandler' });
  
  if (errorInfo) {
    logger.debug('Error Info', { errorInfo, component: 'reactErrorHandler' });
    
    // Log specific details for replace errors
    if (error.message?.includes('replace')) {
      logger.debug('Replace Error Details', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        component: 'reactErrorHandler'
      });
    }
  }

  // Show user-friendly message
  toast.error('Something went wrong', {
    description: 'Please refresh the page or try again later.',
  });
};

export const handleQueryError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'An error occurred';
  
  if (import.meta.env.DEV) {
    logger.error('Query Error:', error);
  }

  // Don't show toast for network errors during development
  if (!message.includes('Failed to fetch') || !import.meta.env.DEV) {
    toast.error('Failed to load data', {
      description: 'Please check your connection and try again.',
    });
  }
};

export const handleMutationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'An error occurred';
  
  if (import.meta.env.DEV) {
    logger.error('Mutation Error:', error);
  }

  toast.error('Action failed', {
    description: message || 'Please try again.',
  });
};

// Global error handler for unhandled promise rejections
export const setupGlobalErrorHandlers = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    
    if (import.meta.env.DEV) {
      logger.error('Unhandled Promise Rejection:', event.reason);
    }

    toast.error('An unexpected error occurred', {
      description: 'Our team has been notified.',
    });
  });

  window.addEventListener('error', (event) => {
    event.preventDefault();
    
    if (import.meta.env.DEV) {
      logger.error('Global Error:', event.error);
    }
  });
};
