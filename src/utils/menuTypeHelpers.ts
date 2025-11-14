/**
 * Type Safety Helpers for Menu Components
 * Safely convert Json types to React-compatible types
 */

import type { Json } from '@/integrations/supabase/types';

export const jsonToString = (value: Json | undefined | null): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  return JSON.stringify(value);
};

export const jsonToNumber = (value: Json | undefined | null): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
};

export const safeJsonAccess = (
  obj: Json | undefined | null,
  key: string
): Json | undefined => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  return (obj as Record<string, Json>)[key];
};

export const jsonToStringOrNumber = (value: Json | undefined | null): string | number => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value.toString();
  return JSON.stringify(value);
};
