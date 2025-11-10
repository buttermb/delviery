import popularData from "@/data/popular_strains.json";

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
 * @param input - User input text
 * @param type - Either "brand" or "strain"
 * @returns Array of matching suggestions (max 5), sorted by relevance
 */
export const getSuggestions = (input: string, type: SuggestionType): string[] => {
  if (!input || input.trim().length === 0) {
    return [];
  }

  const list = type === "brand" ? popularData.brands : popularData.strains;
  const term = input.toLowerCase().trim();

  // Get matches with similarity scores
  const matches = list
    .map(item => ({
      item,
      score: calculateSimilarity(term, item)
    }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score) // Sort by relevance
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

