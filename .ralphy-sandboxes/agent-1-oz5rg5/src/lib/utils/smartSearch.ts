/**
 * Smart search utilities for fuzzy matching
 * Handles case-insensitivity, partial matches, and multi-field search
 */

export interface SearchOptions {
  /** Fields to search in */
  fields: string[];
  /** Minimum characters before searching */
  minChars?: number;
  /** Maximum results to return */
  maxResults?: number;
  /** Enable fuzzy matching (typo tolerance) */
  fuzzy?: boolean;
  /** Highlight matching text in results */
  highlight?: boolean;
}

interface SearchResult<T> {
  item: T;
  score: number;
  matches: Array<{
    field: string;
    value: string;
    indices: [number, number][];
  }>;
}

/**
 * Smart search that handles:
 * - Case-insensitive matching
 * - Partial/substring matching
 * - Multi-field search
 * - Relevance scoring
 * 
 * @example
 * ```ts
 * const results = smartSearch('john', customers, {
 *   fields: ['name', 'email', 'phone'],
 * });
 * ```
 */
export function smartSearch<T extends Record<string, any>>(
  query: string,
  items: T[],
  options: SearchOptions
): T[] {
  const {
    fields,
    minChars = 1,
    maxResults = 50,
    fuzzy = false,
  } = options;

  // Normalize query
  const normalizedQuery = query.toLowerCase().trim();

  // Return all items if query too short
  if (normalizedQuery.length < minChars) {
    return items.slice(0, maxResults);
  }

  // Split query into words for multi-word search
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

  // Score and filter items
  const scored: SearchResult<T>[] = items
    .map(item => {
      let totalScore = 0;
      const matches: SearchResult<T>['matches'] = [];

      for (const field of fields) {
        const value = getNestedValue(item, field);
        if (value === null || value === undefined) continue;

        const strValue = String(value).toLowerCase();
        const fieldScore = calculateFieldScore(strValue, queryWords, fuzzy);

        if (fieldScore > 0) {
          totalScore += fieldScore;
          matches.push({
            field,
            value: String(value),
            indices: findMatchIndices(strValue, queryWords),
          });
        }
      }

      return { item, score: totalScore, matches };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map(r => r.item);
}

/**
 * Calculate match score for a field value
 */
function calculateFieldScore(
  value: string,
  queryWords: string[],
  fuzzy: boolean
): number {
  let score = 0;

  for (const word of queryWords) {
    // Exact match (highest score)
    if (value === word) {
      score += 100;
      continue;
    }

    // Starts with (high score)
    if (value.startsWith(word)) {
      score += 75;
      continue;
    }

    // Word boundary match
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(word)}`, 'i');
    if (wordBoundaryRegex.test(value)) {
      score += 50;
      continue;
    }

    // Contains (medium score)
    if (value.includes(word)) {
      score += 25;
      continue;
    }

    // Fuzzy match (low score)
    if (fuzzy && fuzzyMatch(value, word)) {
      score += 10;
      continue;
    }
  }

  return score;
}

/**
 * Simple fuzzy matching (allows 1 character difference per 4 characters)
 */
function fuzzyMatch(value: string, query: string): boolean {
  if (query.length < 3) return false;

  const allowedErrors = Math.floor(query.length / 4);
  let errors = 0;
  let valueIndex = 0;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const found = value.indexOf(char, valueIndex);

    if (found === -1) {
      errors++;
      if (errors > allowedErrors) return false;
    } else {
      valueIndex = found + 1;
    }
  }

  return true;
}

/**
 * Find match indices for highlighting
 */
function findMatchIndices(
  value: string,
  queryWords: string[]
): [number, number][] {
  const indices: [number, number][] = [];

  for (const word of queryWords) {
    let start = 0;
    while (true) {
      const index = value.indexOf(word, start);
      if (index === -1) break;
      indices.push([index, index + word.length]);
      start = index + 1;
    }
  }

  return mergeOverlappingRanges(indices);
}

/**
 * Merge overlapping index ranges
 */
function mergeOverlappingRanges(
  ranges: [number, number][]
): [number, number][] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Get nested object value by dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight matching text in a string
 * 
 * @example
 * ```tsx
 * const highlighted = highlightMatches('John Smith', 'john');
 * // Returns: ['<mark>John</mark>', ' Smith']
 * ```
 */
export function highlightMatches(
  text: string,
  query: string,
  highlightClass = 'bg-yellow-200 dark:bg-yellow-900'
): React.ReactNode[] {
  if (!query.trim()) return [text];

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);

  const indices = findMatchIndices(normalizedText, words);
  if (indices.length === 0) return [text];

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      parts.push(text.slice(lastEnd, start));
    }
    parts.push(
      `<span class="${highlightClass}">${text.slice(start, end)}</span>`
    );
    lastEnd = end;
  }

  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }

  return parts;
}

/**
 * Debounced search hook helper
 */
export function createSearchDebouncer(delayMs = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (callback: () => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(callback, delayMs);
  };
}

export default smartSearch;
