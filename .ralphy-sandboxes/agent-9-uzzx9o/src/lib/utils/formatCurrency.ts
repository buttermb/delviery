/**
 * Currency Formatting Utilities
 * Consistent currency formatting across the app
 */

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '$0.00';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '$0.00';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Format a number as currency without currency symbol
 */
export function formatCurrencyNumber(
  amount: number | string | null | undefined,
  decimals: number = 2
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0.00';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '0.00';
  }

  return numAmount.toFixed(decimals);
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '$0';
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '$0';
  }

  if (numAmount >= 1_000_000_000) {
    return `$${(numAmount / 1_000_000_000).toFixed(1)}B`;
  }
  if (numAmount >= 1_000_000) {
    return `$${(numAmount / 1_000_000).toFixed(1)}M`;
  }
  if (numAmount >= 1_000) {
    return `$${(numAmount / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(numAmount, currency);
}

