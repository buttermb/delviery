/**
 * URL-Based Filter Persistence Hook
 * Stores filters in URL params for shareable links + browser back/forward support
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface FilterConfig<T> {
  key: keyof T;
  defaultValue: T[keyof T];
  type?: 'string' | 'number' | 'boolean' | 'array';
}

export function useUrlFilters<T extends Record<string, any>>(
  config: FilterConfig<T>[]
): [T, (newFilters: Partial<T>) => void, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse current filters from URL
  const filters = useMemo(() => {
    const result = {} as T;

    config.forEach(({ key, defaultValue, type = 'string' }) => {
      const paramValue = searchParams.get(String(key));

      if (paramValue === null) {
        result[key] = defaultValue;
      } else {
        switch (type) {
          case 'number':
            result[key] = (Number(paramValue) || defaultValue) as T[keyof T];
            break;
          case 'boolean':
            result[key] = (paramValue === 'true') as T[keyof T];
            break;
          case 'array':
            result[key] = paramValue.split(',').filter(Boolean) as T[keyof T];
            break;
          default:
            result[key] = paramValue as T[keyof T];
        }
      }
    });

    return result;
  }, [searchParams, config]);

  // Update filters
  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      setSearchParams((prev) => {
        const updated = new URLSearchParams(prev);

        Object.entries(newFilters).forEach(([key, value]) => {
          const configItem = config.find((c) => c.key === key);
          if (!configItem) return;

          const isDefault =
            value === configItem.defaultValue ||
            (Array.isArray(value) && value.length === 0) ||
            value === '' ||
            value === null ||
            value === undefined;

          if (isDefault) {
            updated.delete(key);
          } else if (Array.isArray(value)) {
            updated.set(key, value.join(','));
          } else {
            updated.set(key, String(value));
          }
        });

        return updated;
      });
    },
    [setSearchParams, config]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      config.forEach(({ key }) => updated.delete(String(key)));
      return updated;
    });
  }, [setSearchParams, config]);

  return [filters, setFilters, clearFilters];
}

// Pre-defined filter hooks for common use cases
export function useOrderFilters() {
  return useUrlFilters([
    { key: 'status', defaultValue: '' },
    { key: 'date', defaultValue: '' },
    { key: 'client', defaultValue: '' },
    { key: 'page', defaultValue: 1, type: 'number' },
  ]);
}

export function useCustomerFilters() {
  return useUrlFilters([
    { key: 'status', defaultValue: '' },
    { key: 'tag', defaultValue: '' },
    { key: 'search', defaultValue: '' },
    { key: 'page', defaultValue: 1, type: 'number' },
  ]);
}

export function useProductFilters() {
  return useUrlFilters([
    { key: 'category', defaultValue: '' },
    { key: 'status', defaultValue: '' },
    { key: 'stock', defaultValue: '' },
    { key: 'search', defaultValue: '' },
    { key: 'page', defaultValue: 1, type: 'number' },
  ]);
}
