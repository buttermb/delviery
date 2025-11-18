// src/lib/utils/encryptionErrorHandler.ts
// Centralized error handling for encryption operations

import { logger } from '../logger';
import { ERROR_MESSAGES } from '../encryption/constants';
import { sanitizeError } from '../encryption/utils';

export interface EncryptionErrorInfo {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

/**
 * Handle encryption errors gracefully
 */
export function handleEncryptionError(error: unknown, context?: string): EncryptionErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log error with context
  logger.error(
    'Encryption error',
    error instanceof Error ? error : new Error(String(error)),
    { component: context || 'EncryptionErrorHandler' }
  );

  // Determine error type and provide user-friendly message
  if (errorMessage.includes(ERROR_MESSAGES.NOT_INITIALIZED) || errorMessage.includes('not ready')) {
    return {
      code: 'NOT_INITIALIZED',
      message: errorMessage,
      userMessage: 'Encryption not ready. Please log in again.',
      recoverable: true,
    };
  }

  if (errorMessage.includes(ERROR_MESSAGES.SESSION_EXPIRED) || errorMessage.includes('expired')) {
    return {
      code: 'SESSION_EXPIRED',
      message: errorMessage,
      userMessage: 'Your encryption session has expired. Please log in again.',
      recoverable: true,
    };
  }

  if (errorMessage.includes(ERROR_MESSAGES.DECRYPTION_FAILED) || errorMessage.includes('decrypt')) {
    return {
      code: 'DECRYPTION_FAILED',
      message: errorMessage,
      userMessage: 'Failed to decrypt data. This may be due to a password change or data corruption.',
      recoverable: false,
    };
  }

  if (errorMessage.includes(ERROR_MESSAGES.ENCRYPTION_FAILED) || errorMessage.includes('encrypt')) {
    return {
      code: 'ENCRYPTION_FAILED',
      message: errorMessage,
      userMessage: 'Failed to encrypt data. Please try again.',
      recoverable: true,
    };
  }

  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: sanitizeError(error),
    userMessage: 'An encryption error occurred. Please try again or contact support.',
    recoverable: true,
  };
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const errorInfo = handleEncryptionError(error);
  return errorInfo.recoverable;
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  const errorInfo = handleEncryptionError(error);
  return errorInfo.userMessage;
}

