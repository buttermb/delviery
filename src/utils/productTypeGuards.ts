/**
 * Product Type Guards and Utilities
 * Safely handle unknown product properties from Supabase
 */

import type { Numeric } from "@/types/money";

/**
 * Convert Numeric (number | string) to number
 */
export const toNumber = (value: Numeric | unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Safely get number value from unknown
 */
export const getNumberValue = (value: unknown, defaultValue: number = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

/**
 * Safely get string value from unknown
 */
export const getStringValue = (value: unknown, defaultValue: string = ''): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return defaultValue;
  return String(value);
};

/**
 * Safely get string array from unknown
 */
export const getStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
};

/**
 * Safely get date from unknown
 */
export const getDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/**
 * Check if value is a valid object
 */
export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Safely get object from unknown
 */
export const getObjectValue = <T = Record<string, unknown>>(
  value: unknown,
  defaultValue: T = {} as T
): T => {
  return isObject(value) ? (value as T) : defaultValue;
};

/**
 * Convert Record<string, Numeric> to Record<string, number>
 */
export const normalizeNumericRecord = (
  record: Record<string, Numeric> | null | undefined
): Record<string, number> | null => {
  if (!record || typeof record !== 'object') return null;
  
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = toNumber(value);
  }
  return normalized;
};
