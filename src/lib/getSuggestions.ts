import popularData from "@/data/popular_strains.json";

export type SuggestionType = "brand" | "strain";

/**
 * Get autocomplete suggestions for brands or strains
 * @param input - User input text
 * @param type - Either "brand" or "strain"
 * @returns Array of matching suggestions (max 5)
 */
export const getSuggestions = (input: string, type: SuggestionType): string[] => {
  if (!input || input.trim().length === 0) {
    return [];
  }

  const list = type === "brand" ? popularData.brands : popularData.strains;
  const term = input.toLowerCase().trim();

  return list
    .filter(item => item.toLowerCase().includes(term))
    .slice(0, 5);
};

/**
 * Get all suggestions (no filtering) - useful for initial display
 */
export const getAllSuggestions = (type: SuggestionType): string[] => {
  return type === "brand" ? popularData.brands : popularData.strains;
};

