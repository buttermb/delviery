// src/lib/hooks/useEncryptedQuery.ts

'use client';
import { logger } from '@/lib/logger';

import { useEffect, useState } from 'react';
import { useEncryption } from './useEncryption';
import { supabase } from '@/integrations/supabase/client';

interface UseEncryptedQueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  single?: boolean;
}

interface UseEncryptedQueryResult<T> {
  data: T | T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for querying encrypted data from Supabase
 * Automatically decrypts results
 */
export function useEncryptedQuery<T = any>({
  table,
  select = '*',
  filters = {},
  single = false,
}: UseEncryptedQueryOptions): UseEncryptedQueryResult<T> {
  const { isReady, decryptObject } = useEncryption();
  const [data, setData] = useState<T | T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!isReady) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query with type assertion to bypass strict type checking
      let query = supabase.from(table as any).select(select);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      // Execute query
      const { data: encryptedData, error: queryError } = single
        ? await query.maybeSingle()
        : await query;

      if (queryError) throw queryError;

      // Decrypt data
      if (single) {
        const decrypted = encryptedData
          ? decryptObject<T>(encryptedData as Record<string, unknown>)
          : null;
        setData(decrypted);
      } else {
        const dataArray = Array.isArray(encryptedData) ? encryptedData : [];
        const decrypted = dataArray.map((record) =>
          decryptObject<T>(record as Record<string, unknown>)
        );
        setData(decrypted as T | T[] | null);
      }
    } catch (err) {
      logger.error('Query error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isReady, table, select, JSON.stringify(filters), single]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

