/**
 * Percentage Formatting Utilities
 * Consistent percentage formatting across the app
 */

/**
 * Format number as percentage
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimals: number = 1,
  includeSign: boolean = false
): string {
  if (value === null || value === undefined || value === '') {
    return '0%';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '0%';
  }

  const formatted = numValue.toFixed(decimals);
  const sign = includeSign && numValue >= 0 ? '+' : '';

  return `${sign}${formatted}%`;
}

/**
 * Format percentage with color indication
 */
export function formatPercentageWithTrend(
  value: number | string | null | undefined,
  decimals: number = 1
): {
  formatted: string;
  trend: 'positive' | 'negative' | 'neutral';
} {
  if (value === null || value === undefined || value === '') {
    return { formatted: '0%', trend: 'neutral' };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { formatted: '0%', trend: 'neutral' };
  }

  const formatted = formatPercentage(numValue, decimals, true);

  if (numValue > 0) {
    return { formatted, trend: 'positive' };
  }
  if (numValue < 0) {
    return { formatted, trend: 'negative' };
  }

  return { formatted, trend: 'neutral' };
}

