/**
 * Weight Formatting Utilities
 * Consistent weight formatting for inventory
 */

/**
 * Format weight in pounds
 */
export function formatWeight(
  weight: number | string | null | undefined,
  unit: 'lbs' | 'kg' | 'oz' = 'lbs',
  decimals: number = 1
): string {
  if (weight === null || weight === undefined || weight === '') {
    return `0.${'0'.repeat(decimals)} ${unit}`;
  }

  const numWeight = typeof weight === 'string' ? parseFloat(weight) : weight;

  if (isNaN(numWeight)) {
    return `0.${'0'.repeat(decimals)} ${unit}`;
  }

  return `${numWeight.toFixed(decimals)} ${unit}`;
}

/**
 * Format weight with smart units
 */
export function formatWeightSmart(
  weight: number | string | null | undefined,
  decimals: number = 1
): string {
  if (weight === null || weight === undefined || weight === '') {
    return '0 lbs';
  }

  const numWeight = typeof weight === 'string' ? parseFloat(weight) : weight;

  if (isNaN(numWeight)) {
    return '0 lbs';
  }

  if (numWeight >= 1) {
    return `${numWeight.toFixed(decimals)} lbs`;
  }

  // Convert to ounces for weights less than 1 lb
  const ounces = numWeight * 16;
  return `${ounces.toFixed(0)} oz`;
}

