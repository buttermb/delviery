import React, { useMemo, useState, useCallback } from 'react';
import Fuse, { IFuseOptions } from 'fuse.js';

interface UseFuzzySearchOptions<T> extends IFuseOptions<T> {
  /** Minimum characters before search starts */
  minSearchLength?: number;
  /** Maximum results to return */
  maxResults?: number;
}

interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matches?: ReadonlyArray<{
    indices: ReadonlyArray<readonly [number, number]>;
    key?: string;
    value?: string;
  }>;
}

interface UseFuzzySearchReturn<T> {
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Filtered results */
  results: T[];
  /** Results with match details */
  resultsWithScore: FuzzySearchResult<T>[];
  /** Whether a search is active */
  isSearching: boolean;
  /** Clear the search */
  clearSearch: () => void;
  /** Suggested correction if no results */
  suggestion: string | null;
}

const defaultOptions: IFuseOptions<unknown> = {
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  findAllMatches: true,
};

export function useFuzzySearch<T>(
  items: T[],
  keys: string[],
  options?: UseFuzzySearchOptions<T>
): UseFuzzySearchReturn<T> {
  const [query, setQuery] = useState('');
  
  const { minSearchLength = 1, maxResults = 50, ...fuseOptions } = options || {};

  const fuse = useMemo(() => {
    return new Fuse(items, {
      ...defaultOptions,
      ...fuseOptions,
      keys,
    });
  }, [items, keys, fuseOptions]);

  const searchResults = useMemo(() => {
    if (!query || query.length < minSearchLength) {
      return { results: items, resultsWithScore: [], isSearching: false };
    }

    const fuseResults = fuse.search(query, { limit: maxResults });
    
    return {
      results: fuseResults.map((r) => r.item),
      resultsWithScore: fuseResults.map((r) => ({
        item: r.item,
        score: r.score ?? 0,
        matches: r.matches,
      })),
      isSearching: true,
    };
  }, [query, fuse, items, minSearchLength, maxResults]);

  // Generate suggestion for "did you mean"
  const suggestion = useMemo(() => {
    if (!query || query.length < 3 || searchResults.results.length > 0) {
      return null;
    }

    // Try with a higher threshold to find near-matches
    const looseFuse = new Fuse(items, {
      ...defaultOptions,
      threshold: 0.6,
      keys,
    });

    const looseResults = looseFuse.search(query, { limit: 1 });
    if (looseResults.length > 0 && looseResults[0].matches?.[0]?.value) {
      return looseResults[0].matches[0].value;
    }

    return null;
  }, [query, items, keys, searchResults.results.length]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    results: searchResults.results as T[],
    resultsWithScore: searchResults.resultsWithScore as FuzzySearchResult<T>[],
    isSearching: searchResults.isSearching,
    clearSearch,
    suggestion,
  };
}

/**
 * Highlight matched text in a string
 */
export function highlightMatches(
  text: string,
  indices: ReadonlyArray<readonly [number, number]>
): React.ReactNode[] {
  if (!indices || indices.length === 0) {
    return [text];
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  indices.forEach(([start, end], i) => {
    // Add text before match
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }
    // Add highlighted match
    result.push(
      <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
