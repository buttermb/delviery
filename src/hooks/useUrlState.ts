import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

type SerializableValue = string | number | boolean | null | undefined;

interface UrlStateOptions<T> {
  /** Default values when not in URL */
  defaults: T;
  /** Keys to exclude from URL (always use default) */
  exclude?: (keyof T)[];
  /** Custom serializers for complex values */
  serialize?: Partial<Record<keyof T, (value: any) => string>>;
  /** Custom deserializers for complex values */
  deserialize?: Partial<Record<keyof T, (value: string) => any>>;
}

/**
 * Hook to sync state with URL query parameters
 * Enables deep linking and shareable filter states
 * 
 * @example
 * ```tsx
 * const { state, setState, resetToDefaults, getShareableUrl } = useUrlState({
 *   defaults: {
 *     status: 'all',
 *     sortBy: 'date',
 *     sortOrder: 'desc',
 *     search: '',
 *     page: 1,
 *   },
 * });
 * 
 * // state.status, state.sortBy, etc. are synced with URL
 * // setState({ status: 'pending' }) updates URL
 * ```
 */
export function useUrlState<T extends Record<string, SerializableValue>>(
  options: UrlStateOptions<T>
) {
  const { defaults, exclude = [], serialize = {}, deserialize = {} } = options;
  
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Parse current URL state
  const state = useMemo(() => {
    const result = { ...defaults } as T;

    for (const key of Object.keys(defaults) as (keyof T)[]) {
      if (exclude.includes(key)) continue;

      const urlValue = searchParams.get(key as string);
      if (urlValue === null) continue;

      // Use custom deserializer if provided
      const customDeserialize = (deserialize as Record<string, ((value: string) => any) | undefined>)[key as string];
      if (customDeserialize) {
        result[key] = customDeserialize(urlValue);
        continue;
      }

      // Auto-deserialize based on default value type
      const defaultValue = defaults[key];
      if (typeof defaultValue === 'number') {
        const parsed = parseFloat(urlValue);
        result[key] = (isNaN(parsed) ? defaultValue : parsed) as T[keyof T];
      } else if (typeof defaultValue === 'boolean') {
        result[key] = (urlValue === 'true') as T[keyof T];
      } else {
        result[key] = urlValue as T[keyof T];
      }
    }

    return result;
  }, [searchParams, defaults, exclude, deserialize]);

  // Update URL with new state
  const setState = useCallback(
    (updates: Partial<T>) => {
      const newParams = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (exclude.includes(key as keyof T)) continue;

        const defaultValue = defaults[key as keyof T];
        const customSerialize = (serialize as Record<string, ((value: any) => string) | undefined>)[key];

        // Remove from URL if matches default
        if (value === defaultValue || value === '' || value === null || value === undefined) {
          newParams.delete(key);
          continue;
        }

        // Serialize value
        const serialized = customSerialize
          ? customSerialize(value)
          : String(value);

        newParams.set(key, serialized);
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, defaults, exclude, serialize]
  );

  // Reset all to defaults (clear URL params)
  const resetToDefaults = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // Get full shareable URL
  const getShareableUrl = useCallback(() => {
    return `${window.location.origin}${location.pathname}${location.search}`;
  }, [location]);

  // Copy URL to clipboard
  const copyShareableUrl = useCallback(async () => {
    const url = getShareableUrl();
    await navigator.clipboard.writeText(url);
    return url;
  }, [getShareableUrl]);

  // Check if any filters are active (different from defaults)
  const hasActiveFilters = useMemo(() => {
    return Object.keys(defaults).some(key => {
      if (exclude.includes(key as keyof T)) return false;
      return state[key as keyof T] !== defaults[key as keyof T];
    });
  }, [state, defaults, exclude]);

  return {
    state,
    setState,
    resetToDefaults,
    getShareableUrl,
    copyShareableUrl,
    hasActiveFilters,
  };
}

/**
 * Simplified hook for pagination state in URL
 */
export function useUrlPagination(defaultPage = 1, defaultPageSize = 10) {
  const { state, setState } = useUrlState({
    defaults: {
      page: defaultPage,
      pageSize: defaultPageSize,
    },
  });

  const setPage = useCallback(
    (page: number) => setState({ page }),
    [setState]
  );

  const setPageSize = useCallback(
    (pageSize: number) => setState({ pageSize, page: 1 }),
    [setState]
  );

  return {
    page: state.page,
    pageSize: state.pageSize,
    setPage,
    setPageSize,
  };
}

/**
 * Simplified hook for sort state in URL
 */
export function useUrlSort<T extends string>(
  defaultSortBy: T,
  defaultSortOrder: 'asc' | 'desc' = 'desc'
) {
  const { state, setState } = useUrlState({
    defaults: {
      sortBy: defaultSortBy,
      sortOrder: defaultSortOrder,
    },
  });

  const setSort = useCallback(
    (sortBy: T, sortOrder?: 'asc' | 'desc') => {
      // If clicking same column, toggle order
      const newOrder = sortOrder ?? (
        state.sortBy === sortBy && state.sortOrder === 'desc' ? 'asc' : 'desc'
      );
      setState({ sortBy, sortOrder: newOrder });
    },
    [state.sortBy, state.sortOrder, setState]
  );

  return {
    sortBy: state.sortBy as T,
    sortOrder: state.sortOrder as 'asc' | 'desc',
    setSort,
  };
}

export default useUrlState;
