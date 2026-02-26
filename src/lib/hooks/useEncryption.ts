// src/lib/hooks/useEncryption.ts

'use client';
import { logger } from '@/lib/logger';

import { useEffect, useState, useCallback } from 'react';
import { clientEncryption } from '../encryption/clientEncryption';
import type { EncryptionHookResult, EncryptableValue } from '../encryption/types';
import { STORAGE_KEYS } from '@/constants/storageKeys';

/**
 * React hook for encryption operations
 * Provides encrypt/decrypt functions throughout app
 * Automatically handles session restoration
 */
export function useEncryption(): EncryptionHookResult {
  const [isReady, setIsReady] = useState(false);

  // Try to restore session on mount
  useEffect(() => {
    if (clientEncryption.restoreSession()) {
      setIsReady(true);
    }
  }, []);

  // Check session expiry periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (clientEncryption.isSessionExpired()) {
        setIsReady(false);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  /**
   * Initialize encryption with password
   */
  const initialize = useCallback(async (password: string) => {
    // Get user ID from sessionStorage or localStorage
    // This should be set by auth context after login
    const userId = sessionStorage.getItem('floraiq_user_id') || localStorage.getItem(STORAGE_KEYS.FLORAIQ_USER_ID);
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      await clientEncryption.initialize(password, userId);
      setIsReady(true);
    } catch (error) {
      // Use logger if available, otherwise console
      // Note: logger is imported from @/lib/logger but we avoid importing here
      // to prevent circular dependencies. This is a fallback.
      try {
        const { logger } = await import('@/lib/logger');
        logger.error('Failed to initialize encryption', error instanceof Error ? error : new Error(String(error)), { component: 'useEncryption' });
      } catch {
        // Fallback to console if logger not available
        logger.error('Failed to initialize encryption:', error);
      }
      throw error;
    }
  }, []);

  /**
   * Encrypt a value
   */
  const encrypt = useCallback((value: unknown): string => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }
    return clientEncryption.encrypt(value as EncryptableValue);
  }, [isReady]);

  /**
   * Decrypt a value
   */
  const decrypt = useCallback(<T = string>(value: string): T => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }
    return clientEncryption.decrypt<T>(value);
  }, [isReady]);

  /**
   * Encrypt entire object
   */
  const encryptObject = useCallback(<T extends Record<string, unknown>>(
    obj: T
  ): Record<string, string> => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }
    return clientEncryption.encryptObject(obj);
  }, [isReady]);

  /**
   * Decrypt entire object
   */
  const decryptObject = useCallback(<T extends Record<string, unknown>>(
    obj: Record<string, string>
  ): T => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }
    return clientEncryption.decryptObject<T>(obj);
  }, [isReady]);

  /**
   * Create search hash
   */
  const createSearchHash = useCallback((value: string): string => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }
    return clientEncryption.createSearchHash(value);
  }, [isReady]);

  /**
   * Destroy encryption session
   */
  const destroy = useCallback(() => {
    clientEncryption.destroy();
    setIsReady(false);
  }, []);

  return {
    isReady,
    initialize,
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    createSearchHash,
    destroy,
  };
}

