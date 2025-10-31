/**
 * Utility function to clean product names by removing THCA references
 */

export function cleanProductName(name: string): string {
  if (!name) return name;
  
  // Remove "THCA" variations from product names
  let cleaned = name
    .replace(/\bTHCA\b/gi, '')
    .replace(/\bTHCa\b/gi, '')
    .replace(/\bTHC\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

export function cleanProductNameWithFallback(name: string | undefined | null): string {
  if (!name) return '';
  
  const cleaned = cleanProductName(name);
  
  // If after cleaning we have an empty string, return a fallback
  if (!cleaned) return 'Premium Product';
  
  return cleaned;
}

