/**
 * Number Formatting Utilities
 * Consistent number formatting across the app
 */

/**
 * Format number with thousand separators
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: { 
    decimals?: number; 
    fallback?: string;
    locale?: string;
  }
): string {
  const { decimals = 0, fallback = '0', locale = 'en-US' } = options || {};

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return fallback;
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Format number as percentage
 */
export function formatPercent(
  value: number | string | null | undefined,
  options?: { 
    decimals?: number; 
    fallback?: string;
    includeSign?: boolean;
  }
): string {
  const { decimals = 1, fallback = '0%', includeSign = false } = options || {};

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return fallback;
  }

  const formatted = numValue.toFixed(decimals);
  const sign = includeSign && numValue > 0 ? '+' : '';
  
  return `${sign}${formatted}%`;
}

/**
 * Format quantity with unit (handles singular/plural)
 */
export function formatQuantity(
  value: number | string | null | undefined,
  unit: string = 'items',
  options?: {
    fallback?: string;
    showZero?: boolean;
  }
): string {
  const { fallback = `0 ${unit}`, showZero = true } = options || {};

  if (value === null || value === undefined || value === '') {
    return showZero ? fallback : '—';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return fallback;
  }

  if (numValue === 0 && !showZero) {
    return '—';
  }

  const formattedNum = formatNumber(numValue);
  
  // Handle singular/plural
  const singularUnit = unit.replace(/s$/, '');
  const displayUnit = numValue === 1 ? singularUnit : unit;

  return `${formattedNum} ${displayUnit}`;
}

/**
 * Pluralize a word based on count
 * pluralize(1, 'item') → '1 item'
 * pluralize(0, 'item') → '0 items'
 * pluralize(5, 'item') → '5 items'
 * pluralize(1, 'category', 'categories') → '1 category'
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const pluralForm = plural || `${singular}s`;
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatCompactNumber(
  value: number | string | null | undefined,
  options?: {
    decimals?: number;
    fallback?: string;
  }
): string {
  const { decimals = 1, fallback = '0' } = options || {};

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return fallback;
  }

  const absValue = Math.abs(numValue);
  const sign = numValue < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(decimals)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(decimals)}K`;
  }

  return formatNumber(numValue, { decimals });
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(
  minutes: number | null | undefined,
  options?: {
    fallback?: string;
    compact?: boolean;
  }
): string {
  const { fallback = '—', compact = false } = options || {};

  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return fallback;
  }

  if (minutes < 60) {
    return compact ? `${minutes}m` : `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return compact ? `${hours}h` : `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  if (compact) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} min`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(
  bytes: number | null | undefined,
  options?: {
    decimals?: number;
    fallback?: string;
  }
): string {
  const { decimals = 1, fallback = '0 B' } = options || {};

  if (bytes === null || bytes === undefined || isNaN(bytes)) {
    return fallback;
  }

  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
