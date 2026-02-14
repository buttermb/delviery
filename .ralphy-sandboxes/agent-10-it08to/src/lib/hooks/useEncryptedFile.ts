// src/lib/hooks/useEncryptedFile.ts

'use client';

import { useState, useCallback } from 'react';
import { useEncryption } from './useEncryption';
import { clientEncryption } from '../encryption/clientEncryption';
import type { FileEncryptionResult } from '../encryption/types';

interface UseEncryptedFileResult {
  encryptFile: (file: File) => Promise<FileEncryptionResult>;
  decryptFile: (encryptedBlob: Blob, originalType: string) => Promise<Blob>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for file encryption/decryption
 * Encrypts files before upload, decrypts on download
 */
export function useEncryptedFile(): UseEncryptedFileResult {
  const { isReady } = useEncryption();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const encryptFile = useCallback(async (file: File): Promise<FileEncryptionResult> => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    setLoading(true);
    setError(null);

    try {
      const encryptedBlob = await clientEncryption.encryptFile(file);
      
      return {
        encryptedBlob,
        metadata: {
          originalName: file.name,
          originalType: file.type,
          originalSize: file.size,
          encryptedSize: encryptedBlob.size,
        },
      };
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  const decryptFile = useCallback(async (
    encryptedBlob: Blob,
    originalType: string
  ): Promise<Blob> => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    setLoading(true);
    setError(null);

    try {
      const decryptedBlob = await clientEncryption.decryptFile(encryptedBlob, originalType);
      return decryptedBlob;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  return {
    encryptFile,
    decryptFile,
    loading,
    error,
  };
}

