import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type SuggestionType = "brand" | "strain";

interface LeaflySuggestion {
  name: string;
  slug?: string;
  category?: string;
}

interface LeaflyResponse {
  suggestions: LeaflySuggestion[];
  error?: string;
}

/**
 * Cache for Leafly API responses
 * Key: `${type}-${query}`
 * Value: { data: string[], timestamp: number }
 */
const cache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch suggestions from Leafly API (via Edge Function)
 * Falls back to empty array if API fails
 */
export async function fetchLeaflySuggestions(
  query: string,
  type: SuggestionType
): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cacheKey = `${type}-${query.toLowerCase().trim()}`;
  const cached = cache.get(cacheKey);
  
  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Try to fetch from Edge Function
    const { data, error } = await supabase.functions.invoke<LeaflyResponse>(
      "leafly-suggestions",
      {
        body: { query: query.trim(), type },
      }
    );

    if (error) {
      logger.warn("Leafly API error (using local fallback)", { error, query, type }, { component: "leaflyApi" });
      return [];
    }

    // Check for error in response body (some edge functions return 200 with error)
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      logger.warn("Leafly API returned error in response (using local fallback)", { error: data.error, query, type }, { component: "leaflyApi" });
      return [];
    }

    const suggestions = data?.suggestions?.map(s => s.name) || [];
    
    // Cache the results
    cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });
    
    return suggestions;
  } catch (error) {
    logger.warn("Leafly API request failed (using local fallback)", error, { component: "leaflyApi" });
    return [];
  }
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearLeaflyCache() {
  cache.clear();
}

/**
 * Get cache size (for debugging)
 */
export function getCacheSize(): number {
  return cache.size;
}

