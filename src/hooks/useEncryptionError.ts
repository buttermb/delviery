// src/hooks/useEncryptionError.ts
// Hook for handling encryption errors with user-friendly messages

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { handleEncryptionError, getUserErrorMessage } from '@/lib/utils/encryptionErrorHandler';

/**
 * Hook for handling encryption errors
 * Provides user-friendly error messages and toast notifications
 */
export function useEncryptionError() {
  const { toast } = useToast();

  const handleError = useCallback((error: unknown, context?: string) => {
    const errorInfo = handleEncryptionError(error, context);
    
    // Show user-friendly toast
    toast({
      title: 'Encryption Error',
      description: errorInfo.userMessage,
      variant: errorInfo.recoverable ? 'default' : 'destructive',
    });

    return errorInfo;
  }, [toast]);

  const handleErrorSilent = useCallback((error: unknown, context?: string) => {
    // Handle error but don't show toast (for background operations)
    return handleEncryptionError(error, context);
  }, []);

  return {
    handleError,
    handleErrorSilent,
    getUserMessage: getUserErrorMessage,
  };
}

