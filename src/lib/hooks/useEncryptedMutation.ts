// src/lib/hooks/useEncryptedMutation.ts

'use client';

import { useState, useCallback } from 'react';
import { useEncryption } from './useEncryption';
import { supabase } from '@/integrations/supabase/client';
import { getEncryptedFields, getSearchableFields, getEncryptedFieldName, getSearchIndexFieldName } from '../encryption/utils';
import { clientEncryption } from '../encryption/clientEncryption';

interface UseEncryptedMutationOptions {
  table: string;
}

interface UseEncryptedMutationResult {
  insert: (data: Record<string, any>) => Promise<any>;
  update: (id: string, data: Record<string, any>) => Promise<any>;
  upsert: (data: Record<string, any>) => Promise<any>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for encrypted mutations (insert/update/upsert)
 * Automatically encrypts data before sending to Supabase
 */
export function useEncryptedMutation({
  table,
}: UseEncryptedMutationOptions): UseEncryptedMutationResult {
  const { isReady, encrypt, createSearchHash } = useEncryption();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Encrypt a record for the specified table
   */
  const encryptRecord = useCallback((record: Record<string, any>): Record<string, any> => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    const encryptedRecord: Record<string, any> = { ...record };
    const fieldsToEncrypt = getEncryptedFields(table);
    const searchableFields = getSearchableFields(table);

    // Encrypt each field
    for (const field of fieldsToEncrypt) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = record[field];
        
        // Encrypt the field
        const encryptedFieldName = getEncryptedFieldName(field);
        encryptedRecord[encryptedFieldName] = encrypt(value);

        // Create search index if field is searchable
        if (searchableFields.includes(field) && typeof value === 'string') {
          const searchIndexName = getSearchIndexFieldName(field);
          encryptedRecord[searchIndexName] = createSearchHash(value);
        }

        // Remove original field
        delete encryptedRecord[field];
      }
    }

    // Add encryption metadata
    encryptedRecord.encryption_metadata = clientEncryption.getMetadata();

    return encryptedRecord;
  }, [isReady, table, encrypt, createSearchHash]);

  const insert = useCallback(async (data: Record<string, any>) => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    setLoading(true);
    setError(null);

    try {
      const encryptedData = encryptRecord(data);
      const { data: result, error: insertError } = await supabase
        .from(table as any)
        .insert(encryptedData)
        .select()
        .single();

      if (insertError) throw insertError;
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady, table, encryptRecord]);

  const update = useCallback(async (id: string, data: Record<string, any>) => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    setLoading(true);
    setError(null);

    try {
      const encryptedData = encryptRecord(data);
      const { data: result, error: updateError } = await supabase
        .from(table as any)
        .update(encryptedData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady, table, encryptRecord]);

  const upsert = useCallback(async (data: Record<string, any>) => {
    if (!isReady) {
      throw new Error('Encryption not ready');
    }

    setLoading(true);
    setError(null);

    try {
      const encryptedData = encryptRecord(data);
      const { data: result, error: upsertError } = await supabase
        .from(table as any)
        .upsert(encryptedData)
        .select()
        .single();

      if (upsertError) throw upsertError;
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady, table, encryptRecord]);

  return {
    insert,
    update,
    upsert,
    loading,
    error,
  };
}

