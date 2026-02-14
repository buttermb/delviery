/**
 * String Helper Utilities
 * Provides safe string operations with null/undefined checks
 */

/**
 * Safely replace text in a string with null checks
 */
export const safeReplace = (
  str: string | null | undefined,
  search: string | RegExp,
  replace: string
): string => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(search, replace);
};

/**
 * Safely convert string to uppercase with null checks
 */
export const safeUpperCase = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.toUpperCase();
};

/**
 * Safely convert string to lowercase with null checks
 */
export const safeLowerCase = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.toLowerCase();
};

/**
 * Format status strings for display (replaces underscores with spaces)
 */
export const formatStatus = (status: string | null | undefined): string => {
  if (!status || typeof status !== 'string') {
    return 'pending';
  }
  return status.replace(/_/g, ' ');
};

/**
 * Format action type strings for display (replaces underscores with spaces and capitalizes)
 */
export const formatActionType = (action: string | null | undefined): string => {
  if (!action || typeof action !== 'string') {
    return 'unknown';
  }
  return action
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format bug/error type strings for display
 */
export const formatBugType = (type: string | null | undefined): string => {
  if (!type || typeof type !== 'string') {
    return 'unknown';
  }
  return type.replace(/-/g, ' ').replace(/_/g, ' ');
};

/**
 * Safely capitalize first letter of string
 */
export const capitalize = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Safely truncate string to max length
 */
export const truncate = (
  str: string | null | undefined,
  maxLength: number = 50,
  suffix: string = '...'
): string => {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Safely handle status display with null checks
 */
export const safeStatus = (status: string | null | undefined): string => {
  if (!status || typeof status !== 'string' || status.trim() === '') {
    return 'pending';
  }
  return status.replace(/_/g, ' ').toLowerCase();
};

/**
 * Safely handle action type display with null checks
 */
export const safeAction = (action: string | null | undefined): string => {
  if (!action || typeof action !== 'string' || action.trim() === '') {
    return 'unknown';
  }
  return action
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
