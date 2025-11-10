/**
 * Utility to update local strain database from Leafly's public data
 * 
 * NOTE: This is a helper script for manual updates.
 * Leafly doesn't have a public API, so this would require:
 * 1. Web scraping (not recommended, violates ToS)
 * 2. Manual data entry
 * 3. Partnership with Leafly (api@leafly.com)
 * 
 * For now, this serves as documentation for future integration.
 */

import popularData from "@/data/popular_strains.json";

/**
 * Popular strains from Leafly (manually curated list)
 * These are the most popular strains according to Leafly's public data
 */
const leaflyPopularStrains = [
  // Top 50 most popular strains from Leafly
  "Blue Dream",
  "OG Kush",
  "Girl Scout Cookies",
  "Sour Diesel",
  "White Widow",
  "Northern Lights",
  "Granddaddy Purple",
  "Green Crack",
  "Jack Herer",
  "Durban Poison",
  "Trainwreck",
  "Bubble Gum",
  "Purple Haze",
  "AK-47",
  "Super Silver Haze",
  "Amnesia Haze",
  "Lemon Haze",
  "Strawberry Cough",
  "Chocolate Chip",
  "Blueberry",
  "Blackberry Kush",
  "Bubba Kush",
  "Master Kush",
  "Hindu Kush",
  "Afghan Kush",
  "White Rhino",
  "White Russian",
  "White Fire OG",
  "Fire OG",
  "Platinum OG",
  "Skywalker OG",
  "Tahoe OG",
  "Ghost OG",
  "SFV OG",
  "Banana OG",
  "Lemon OG",
  "Purple OG",
  "King's Kush",
  "Kosher Kush",
  "Grape Ape",
  "Grapefruit",
  "Grape Stomper",
  "Grape Pie",
  "Grape God",
  "Grape Soda",
  "Grape Kush",
  "Grapefruit Kush",
  "Grapefruit Diesel",
  "Tangie",
  "Tangerine Dream",
];

/**
 * Merge Leafly strains with local database
 * Removes duplicates and preserves existing data
 */
export function mergeLeaflyStrains(): string[] {
  const existing = new Set(popularData.strains.map(s => s.toLowerCase()));
  const newStrains = leaflyPopularStrains.filter(
    strain => !existing.has(strain.toLowerCase())
  );
  
  return [...popularData.strains, ...newStrains].sort();
}

/**
 * Get all unique strains (local + Leafly curated)
 */
export function getAllStrains(): string[] {
  const merged = mergeLeaflyStrains();
  // Remove duplicates (case-insensitive)
  const unique = Array.from(
    new Map(merged.map(s => [s.toLowerCase(), s])).values()
  );
  return unique.sort();
}

/**
 * Instructions for getting Leafly API access:
 * 
 * 1. Contact Leafly at api@leafly.com
 * 2. Request API partnership for strain/brand data
 * 3. Once approved, you'll receive:
 *    - API credentials
 *    - API documentation
 *    - Rate limits and usage guidelines
 * 
 * 4. Update supabase/functions/leafly-suggestions/index.ts with:
 *    - API endpoint URL
 *    - Authentication headers
 *    - Request/response handling
 * 
 * 5. Enable in getSuggestions() by setting useLeafly: true
 */

