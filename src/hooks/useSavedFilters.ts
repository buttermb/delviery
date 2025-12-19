/**
 * useSavedFilters - Hook for persisting filter presets to localStorage
 * Reduces friction by remembering user's saved filter configurations
 */

import { useState, useEffect, useCallback } from 'react';

export interface SavedFilter<T> {
  id: string;
  name: string;
  config: T;
  createdAt: string;
}

interface UseSavedFiltersOptions<T> {
  storageKey: string;
  defaultFilters?: T;
}

export function useSavedFilters<T>({ storageKey, defaultFilters }: UseSavedFiltersOptions<T>) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter<T>[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedFilters(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
    }
    setIsLoaded(true);
  }, [storageKey]);

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedFilters));
      } catch (error) {
        console.error('Failed to save filters:', error);
      }
    }
  }, [savedFilters, storageKey, isLoaded]);

  const saveFilter = useCallback((name: string, config: T) => {
    const newFilter: SavedFilter<T> = {
      id: crypto.randomUUID(),
      name,
      config,
      createdAt: new Date().toISOString(),
    };
    setSavedFilters(prev => [...prev, newFilter]);
    return newFilter;
  }, []);

  const updateFilter = useCallback((id: string, updates: Partial<Omit<SavedFilter<T>, 'id'>>) => {
    setSavedFilters(prev => 
      prev.map(filter => 
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  }, []);

  const deleteFilter = useCallback((id: string) => {
    setSavedFilters(prev => prev.filter(filter => filter.id !== id));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSavedFilters([]);
  }, []);

  const getFilterById = useCallback((id: string) => {
    return savedFilters.find(filter => filter.id === id);
  }, [savedFilters]);

  return {
    savedFilters,
    saveFilter,
    updateFilter,
    deleteFilter,
    clearAllFilters,
    getFilterById,
    isLoaded,
  };
}

// Specific filter type definitions for common use cases
export interface ProductFilterConfig {
  category: string[];
  strainType: string[];
  priceRange: [number, number];
  stockRange: [number, number];
  inStock: boolean | null;
}

export interface OrderFilterConfig {
  status: string[];
  dateRange: [string | null, string | null];
  paymentStatus: string[];
  minAmount: number | null;
  maxAmount: number | null;
}

export interface CustomerFilterConfig {
  tags: string[];
  tier: string[];
  hasOrders: boolean | null;
  lastOrderDays: number | null;
}

// Pre-configured hooks for common filter types
export function useProductFilters() {
  return useSavedFilters<ProductFilterConfig>({
    storageKey: 'floraiq_product_filters',
    defaultFilters: {
      category: [],
      strainType: [],
      priceRange: [0, 1000],
      stockRange: [0, 1000],
      inStock: null,
    },
  });
}

export function useOrderFilters() {
  return useSavedFilters<OrderFilterConfig>({
    storageKey: 'floraiq_order_filters',
    defaultFilters: {
      status: [],
      dateRange: [null, null],
      paymentStatus: [],
      minAmount: null,
      maxAmount: null,
    },
  });
}

export function useCustomerFilters() {
  return useSavedFilters<CustomerFilterConfig>({
    storageKey: 'floraiq_customer_filters',
    defaultFilters: {
      tags: [],
      tier: [],
      hasOrders: null,
      lastOrderDays: null,
    },
  });
}
