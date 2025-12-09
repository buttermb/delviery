/**
 * Fuzzy Search Utilities
 * Provides typo-tolerant search with match highlighting
 */

export interface FuzzySearchResult<T> {
    item: T;
    score: number;
    matches: FuzzyMatch[];
}

export interface FuzzyMatch {
    field: string;
    value: string;
    indices: [number, number][];
    score: number;
}

interface FuzzySearchOptions<T> {
    /** Fields to search in each item */
    keys: (keyof T | string)[];
    /** Minimum score to include in results (0-1) */
    threshold?: number;
    /** Whether to sort by score (best first) */
    sortByScore?: boolean;
    /** Maximum number of results */
    limit?: number;
    /** Case sensitive matching */
    caseSensitive?: boolean;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));

    // Initialize first column
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }

    // Initialize first row
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * Calculate fuzzy match score between query and text
 * Returns score from 0 (no match) to 1 (perfect match)
 */
function calculateFuzzyScore(query: string, text: string, caseSensitive: boolean): number {
    const q = caseSensitive ? query : query.toLowerCase();
    const t = caseSensitive ? text : text.toLowerCase();

    // Exact match
    if (t === q) return 1;

    // Contains exact
    if (t.includes(q)) return 0.9 + (q.length / t.length) * 0.1;

    // Word start matches
    const words = t.split(/\s+/);
    for (const word of words) {
        if (word.startsWith(q)) {
            return 0.8 + (q.length / word.length) * 0.1;
        }
    }

    // Fuzzy matching using Levenshtein
    const maxLen = Math.max(q.length, t.length);
    if (maxLen === 0) return 0;

    const distance = levenshteinDistance(q, t);
    const similarity = 1 - distance / maxLen;

    // Apply bonus for common prefix
    let prefixLen = 0;
    while (prefixLen < q.length && prefixLen < t.length && q[prefixLen] === t[prefixLen]) {
        prefixLen++;
    }
    const prefixBonus = prefixLen / q.length * 0.2;

    return Math.min(1, similarity + prefixBonus);
}

/**
 * Find match indices for highlighting
 */
function findMatchIndices(query: string, text: string, caseSensitive: boolean): [number, number][] {
    const q = caseSensitive ? query : query.toLowerCase();
    const t = caseSensitive ? text : text.toLowerCase();
    const indices: [number, number][] = [];

    // Exact substring match
    let pos = 0;
    while ((pos = t.indexOf(q, pos)) !== -1) {
        indices.push([pos, pos + q.length - 1]);
        pos += q.length;
    }

    // If no exact matches, try word starts
    if (indices.length === 0) {
        const words = t.split(/(\s+)/);
        let offset = 0;
        for (const word of words) {
            if (word.toLowerCase().startsWith(q)) {
                indices.push([offset, offset + q.length - 1]);
            }
            offset += word.length;
        }
    }

    // If still no matches, try character-by-character fuzzy
    if (indices.length === 0) {
        let tIndex = 0;
        for (let qIndex = 0; qIndex < q.length && tIndex < t.length; qIndex++) {
            while (tIndex < t.length && t[tIndex] !== q[qIndex]) {
                tIndex++;
            }
            if (tIndex < t.length) {
                indices.push([tIndex, tIndex]);
                tIndex++;
            }
        }
    }

    return indices;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Perform fuzzy search on an array of items
 * 
 * @example
 * ```tsx
 * const items = [
 *   { id: 1, name: 'John Smith', email: 'john@example.com' },
 *   { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
 * ];
 * 
 * const results = fuzzySearch(items, 'jon', {
 *   keys: ['name', 'email'],
 *   threshold: 0.3,
 * });
 * // Returns: [{ item: { id: 1, ... }, score: 0.85, matches: [...] }]
 * ```
 */
export function fuzzySearch<T>(
    items: T[],
    query: string,
    options: FuzzySearchOptions<T>
): FuzzySearchResult<T>[] {
    const {
        keys,
        threshold = 0.3,
        sortByScore = true,
        limit,
        caseSensitive = false,
    } = options;

    if (!query || query.trim() === '') {
        return items.map((item) => ({
            item,
            score: 1,
            matches: [],
        }));
    }

    const results: FuzzySearchResult<T>[] = [];

    for (const item of items) {
        let bestScore = 0;
        const matches: FuzzyMatch[] = [];

        for (const key of keys) {
            const value = getNestedValue(item, key as string);
            if (typeof value !== 'string') continue;

            const score = calculateFuzzyScore(query, value, caseSensitive);

            if (score >= threshold) {
                const indices = findMatchIndices(query, value, caseSensitive);
                matches.push({
                    field: key as string,
                    value,
                    indices,
                    score,
                });
                bestScore = Math.max(bestScore, score);
            }
        }

        if (matches.length > 0) {
            results.push({
                item,
                score: bestScore,
                matches,
            });
        }
    }

    // Sort by score if requested
    if (sortByScore) {
        results.sort((a, b) => b.score - a.score);
    }

    // Apply limit
    if (limit && results.length > limit) {
        return results.slice(0, limit);
    }

    return results;
}

/**
 * Highlight matched portions of text
 * 
 * @example
 * ```tsx
 * const highlighted = highlightMatches('John Smith', [[0, 2]]);
 * // Returns: <><mark>Joh</mark>n Smith</>
 * ```
 */
export function highlightMatches(
    text: string,
    indices: [number, number][],
    highlightClassName = 'bg-yellow-200 dark:bg-yellow-800 rounded px-0.5'
): React.ReactNode {
    if (indices.length === 0) {
        return text;
    }

    // Sort indices by start position
    const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

    // Merge overlapping indices
    const mergedIndices: [number, number][] = [];
    let current = sortedIndices[0];

    for (let i = 1; i < sortedIndices.length; i++) {
        const next = sortedIndices[i];
        if (next[0] <= current[1] + 1) {
            current = [current[0], Math.max(current[1], next[1])];
        } else {
            mergedIndices.push(current);
            current = next;
        }
    }
    mergedIndices.push(current);

    // Build result
    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    for (const [start, end] of mergedIndices) {
        // Add text before match
        if (start > lastEnd) {
            parts.push(text.slice(lastEnd, start));
        }
        // Add highlighted match
        parts.push(
            <mark key={ start } className = { highlightClassName } >
            { text.slice(start, end + 1) }
            </mark>
        );
        lastEnd = end + 1;
    }

    // Add remaining text
    if (lastEnd < text.length) {
        parts.push(text.slice(lastEnd));
    }

    return <>{ parts } </>;
}

/**
 * Hook for managing recent searches
 */
import { useState, useCallback, useEffect } from 'react';

interface UseRecentSearchesOptions {
    storageKey: string;
    maxItems?: number;
}

export function useRecentSearches({
    storageKey,
    maxItems = 10,
}: UseRecentSearchesOptions) {
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch {
            // Ignore errors
        }
        return [];
    });

    // Persist to localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(recentSearches));
        } catch {
            // Ignore errors
        }
    }, [recentSearches, storageKey]);

    const addSearch = useCallback((query: string) => {
        if (!query.trim()) return;

        setRecentSearches((prev) => {
            // Remove if already exists
            const filtered = prev.filter((s) => s !== query);
            // Add to front, limit to maxItems
            return [query, ...filtered].slice(0, maxItems);
        });
    }, [maxItems]);

    const removeSearch = useCallback((query: string) => {
        setRecentSearches((prev) => prev.filter((s) => s !== query));
    }, []);

    const clearSearches = useCallback(() => {
        setRecentSearches([]);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // Ignore errors
            }
        }
    }, [storageKey]);

    return {
        recentSearches,
        addSearch,
        removeSearch,
        clearSearches,
    };
}
