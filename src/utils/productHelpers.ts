/**
 * Product helper utilities
 */

// Standard weight order for cannabis products
const WEIGHT_ORDER = ['3.5g', '7g', '14g', '28g', 'unit'];

/**
 * Sort product weights in the standard order (3.5g -> 7g -> 14g -> 28g)
 */
export const sortProductWeights = (weights: string[]): string[] => {
  return weights.sort((a, b) => {
    const indexA = WEIGHT_ORDER.indexOf(a);
    const indexB = WEIGHT_ORDER.indexOf(b);
    
    // If weight not found in order, put it at the end
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    return indexA - indexB;
  });
};

/**
 * Get the default weight for a product (always 3.5g if available)
 */
export const getDefaultWeight = (prices: Record<string, number> | null | undefined): string => {
  if (!prices || typeof prices !== 'object') return 'unit';
  
  const weights = Object.keys(prices);
  
  // Prefer 3.5g if available
  if (weights.includes('3.5g')) return '3.5g';
  
  // Otherwise return first in sorted order
  const sorted = sortProductWeights(weights);
  return sorted[0] || 'unit';
};

/**
 * Format weight for display
 */
export const formatWeight = (weight: string): string => {
  if (weight === 'unit') return 'Each';
  return weight.toUpperCase();
};
