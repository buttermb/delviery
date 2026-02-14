/**
 * Hook to manage active store selection state
 * Persists selection to localStorage for session continuity
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'activeStoreId';

export function useActiveStore(tenantId: string | undefined) {
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`${STORAGE_KEY}_${tenantId}`);
    return stored || null;
  });

  // Update localStorage when activeStoreId changes
  useEffect(() => {
    if (!tenantId) return;
    
    if (activeStoreId) {
      localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, activeStoreId);
    } else {
      localStorage.removeItem(`${STORAGE_KEY}_${tenantId}`);
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
