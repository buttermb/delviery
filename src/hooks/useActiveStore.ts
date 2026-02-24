/**
 * Hook to manage active store selection state
 * Persists selection to localStorage for session continuity
 */

import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export function useActiveStore(tenantId: string | undefined) {
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`${STORAGE_KEYS.ACTIVE_STORE_PREFIX}${tenantId}`);
    return stored || null;
  });

  // Update localStorage when activeStoreId changes
  useEffect(() => {
    if (!tenantId) return;
    
    if (activeStoreId) {
      localStorage.setItem(`${STORAGE_KEYS.ACTIVE_STORE_PREFIX}${tenantId}`, activeStoreId);
    } else {
      localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_STORE_PREFIX}${tenantId}`);
    }
  }, [activeStoreId, tenantId]);

  const selectStore = useCallback((storeId: string | null) => {
    setActiveStoreId(storeId);
  }, []);

  const clearSelection = useCallback(() => {
    setActiveStoreId(null);
  }, []);

  return {
    activeStoreId,
    selectStore,
    clearSelection,
  };
}
