/**
 * Fuzzy Search Hook
 * Typo-tolerant search using Fuse.js
 */

import { useMemo } from 'react';
import Fuse from 'fuse.js';

interface FuzzySearchOptions<T> {
  keys: (keyof T)[];
  threshold?: number;
  limit?: number;
  minMatchCharLength?: number;
}

export function useFuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions<T>
) {
  const { keys, threshold = 0.4, limit = 10, minMatchCharLength = 2 } = options;

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: keys as string[],
      threshold,
      minMatchCharLength,
      includeScore: true,
      includeMatches: true,
      findAllMatches: true,
      ignoreLocation: true,
    });
  }, [items, keys, threshold, minMatchCharLength]);

  const results = useMemo(() => {
    if (!query || query.length < minMatchCharLength) {
      return items.slice(0, limit);
    }

    const searchResults = fuse.search(query);
    return searchResults.slice(0, limit).map(result => result.item);
  }, [fuse, query, limit, items, minMatchCharLength]);

  return {
    results,
    hasQuery: query.length >= minMatchCharLength,
  };
}

export default useFuzzySearch;
