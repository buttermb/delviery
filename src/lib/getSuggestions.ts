import popularData from "@/data/popular_strains.json";
import { fetchLeaflySuggestions } from "@/lib/leaflyApi";

export type SuggestionType = "brand" | "strain";

/**
 * Calculate similarity score for fuzzy matching
 * Returns a score from 0-1, where 1 is exact match
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Starts with
  if (s2.startsWith(s1)) return 0.9;
  
  // Contains
  if (s2.includes(s1)) return 0.7;
  
  // Word boundary match (e.g., "gel" matches "Gelato")
  const words = s2.split(/\s+/);
  if (words.some(word => word.startsWith(s1))) return 0.8;
  
  // Fuzzy match - check if all characters of input are in order
  let inputIndex = 0;
  for (let i = 0; i < s2.length && inputIndex < s1.length; i++) {
    if (s2[i] === s1[inputIndex]) {
      inputIndex++;
    }
  }
  if (inputIndex === s1.length) return 0.5;
  
  return 0;
};

/**
 * Get autocomplete suggestions for brands or strains with fuzzy matching
 * Combines local database with Leafly API results (if available)
 * @param input - User input text
 * @param type - Either "brand" or "strain"
 * @param useLeafly - Whether to fetch from Leafly API (default: false for now)
 * @returns Array of matching suggestions (max 5), sorted by relevance
 */
export const getSuggestions = async (
  input: string,
  type: SuggestionType,
  useLeafly: boolean = false
): Promise<string[]> => {
  if (!input || input.trim().length === 0) {
    return [];
  }

  const list = type === "brand" ? popularData.brands : popularData.strains;
  const term = input.toLowerCase().trim();

  // Get local matches with similarity scores
  const localMatches = list
    .map(item => ({
      item,
      score: calculateSimilarity(term, item)
    }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score) // Sort by relevance
    .map(match => match.item);

  // If Leafly is enabled and we have few local matches, try API
  let leaflyMatches: string[] = [];
  if (useLeafly && localMatches.length < 3 && type === "strain") {
    try {
      leaflyMatches = await fetchLeaflySuggestions(input, type);
    } catch (error) {
      // Silently fail and use local matches
    }
  }

  // Combine and deduplicate, prioritizing local matches
  const combined = [
    ...localMatches,
    ...leaflyMatches.filter(item => 
      !localMatches.some(local => local.toLowerCase() === item.toLowerCase())
    )
  ];

  // Re-sort combined results by relevance
  const finalMatches = combined
    .map(item => ({
      item,
      score: calculateSimilarity(term, item)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(match => match.item);

  return finalMatches;
};

/**
 * Synchronous version for backward compatibility (uses local database only)
 */
export const getSuggestionsSync = (input: string, type: SuggestionType): string[] => {
  if (!input || input.trim().length === 0) {
    return [];
  }

  const list = type === "brand" ? popularData.brands : popularData.strains;
  const term = input.toLowerCase().trim();

  const matches = list
    .map(item => ({
      item,
      score: calculateSimilarity(term, item)
    }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(match => match.item);

  return matches;
};

/**
 * Get all suggestions (no filtering) - useful for initial display
 */
export const getAllSuggestions = (type: SuggestionType): string[] => {
  return type === "brand" ? popularData.brands : popularData.strains;
};

/**
 * Check if a value is a popular/trending item (top 10)
 */
export const isPopularItem = (value: string, type: SuggestionType): boolean => {
  const list = type === "brand" ? popularData.brands : popularData.strains;
  const topItems = list.slice(0, 10);
  return topItems.some(item => item.toLowerCase() === value.toLowerCase());
};

