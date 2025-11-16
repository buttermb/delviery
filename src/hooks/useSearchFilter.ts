/**
 * Standardized search and filter hook
 * Manages search query and filter state with URL persistence
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseSearchFilterOptions {
  searchKey?: string;
  filterKeys?: string[];
  persistInUrl?: boolean;
  debounceMs?: number;
}

export function useSearchFilter<T>(
  items: T[],
  searchFn: (item: T, query: string) => boolean,
  filterFn?: (item: T, filters: Record<string, string>) => boolean,
  options: UseSearchFilterOptions = {}
) {
  const {
    searchKey = 'search',
    filterKeys = [],
    persistInUrl = true,
    debounceMs = 300,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial values from URL or defaults
  const getSearchFromUrl = () => {
    if (!persistInUrl) return '';
    return searchParams.get(searchKey) || '';
  };

  const getFiltersFromUrl = () => {
    if (!persistInUrl) return {};
    const filters: Record<string, string> = {};
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) {
        filters[key] = value;
      }
    });
    return filters;
  };

  const [searchQuery, setSearchQuery] = useState(getSearchFromUrl);
  const [filters, setFilters] = useState<Record<string, string>>(getFiltersFromUrl);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  // Update URL when search/filters change
  useEffect(() => {
    if (persistInUrl) {
      const params = new URLSearchParams(searchParams);
      
      if (debouncedSearchQuery) {
        params.set(searchKey, debouncedSearchQuery);
      } else {
        params.delete(searchKey);
      }

      filterKeys.forEach((key) => {
        if (filters[key]) {
          params.set(key, filters[key]);
        } else {
          params.delete(key);
        }
      });

      setSearchParams(params, { replace: true });
    }
  }, [debouncedSearchQuery, filters, persistInUrl, searchKey, filterKeys, searchParams, setSearchParams]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    // Apply search filter
    if (debouncedSearchQuery) {
      result = result.filter((item) => searchFn(item, debouncedSearchQuery));
    }

    // Apply custom filters
    if (filterFn) {
      result = result.filter((item) => filterFn(item, filters));
    }

    return result;
  }, [items, debouncedSearchQuery, filters, searchFn, filterFn]);

  // Update filter
  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value === '' || value === 'all') {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  // Check if any filters are active
  const hasActiveFilters = debouncedSearchQuery !== '' || Object.keys(filters).length > 0;

  return {
    // State
    searchQuery,
    debouncedSearchQuery,
    filters,
    filteredItems,
    hasActiveFilters,
    
    // Actions
    setSearchQuery,
    updateFilter,
    clearFilters,
    
    // Computed
    resultCount: filteredItems.length,
    totalCount: items.length,
  };
}

