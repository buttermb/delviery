import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export const useErrorBoundary = () => {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorInfo: null,
  });

  const resetError = () => {
    setErrorState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  const handleError = (error: Error, errorInfo?: React.ErrorInfo) => {
    setErrorState({
      hasError: true,
      error,
      errorInfo: errorInfo || null,
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Show user-friendly toast
    toast({
      variant: 'destructive',
      title: 'Something went wrong',
      description: 'Please try refreshing the page. If the issue persists, contact support.',
    });
  };

  return {
    ...errorState,
    handleError,
    resetError,
  };
};
