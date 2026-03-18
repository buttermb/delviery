/**
 * Product helper utilities
 */

// Standard weight order for wholesale cannabis products
const WEIGHT_ORDER = ['QP', 'HP', 'LB', 'unit'];

/**
 * Sort product weights in the standard order (QP -> HP -> LB)
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
 * Get the default weight for a product (always QP if available)
 * Accepts both number and Numeric (number | string) values
 */
export const getDefaultWeight = (prices: Record<string, number | string> | null | undefined): string => {
  if (!prices || typeof prices !== 'object') return 'unit';
  
  const weights = Object.keys(prices);
  
  // Prefer QP (Quarter Pound) if available - smallest wholesale unit
  if (weights.includes('QP')) return 'QP';
  
  // Otherwise return first in sorted order
  const sorted = sortProductWeights(weights);
  return sorted[0] || 'unit';
};

/**
 * Format weight for display
 */
export const formatWeight = (weight: string): string => {
  if (weight === 'unit') return 'Each';
  if (weight === 'QP') return 'Quarter Pound';
  if (weight === 'HP') return 'Half Pound';
  if (weight === 'LB') return 'Pound';
  return weight.toUpperCase();
};
