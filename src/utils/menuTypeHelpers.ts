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
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  return (obj as Record<string, Json>)[key];
};

export const jsonToStringOrNumber = (value: Json | undefined | null): string | number => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value.toString();
  return JSON.stringify(value);
};

export const jsonToBooleanSafe = (value: Json | undefined | null): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return false;
};

export const safeNestedAccess = (
  obj: Json | undefined | null,
  path: string[]
): Json | undefined => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  
  let current: Json | undefined = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    current = (current as Record<string, Json>)[key];
  }
  return current as Json;
};

export const extractSecuritySetting = (
  securitySettings: Json | undefined | null,
  key: string
): Json | undefined => {
  if (!securitySettings || typeof securitySettings !== 'object' || Array.isArray(securitySettings)) return;
  return (securitySettings as Record<string, Json>)[key];
};
