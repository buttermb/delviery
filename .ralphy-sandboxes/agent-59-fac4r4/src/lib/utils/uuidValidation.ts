/**
 * UUID Validation Utilities
 * Prevents invalid UUID errors in database queries
 */

/**
 * Validate if a string is a valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and clean UUID from route parameters
 * Handles common issues like ':menuId' string literals
 */
export function validateRouteUUID(param: string | undefined | null): string | null {
  if (!param) return null;
  
  // Remove colon prefix if present (route parameter issue)
  const cleaned = param.startsWith(':') ? param.slice(1) : param;
  
  // Remove quotes if present
  const unquoted = cleaned.replace(/^["']|["']$/g, '');
  
  if (isValidUUID(unquoted)) {
    return unquoted;
  }
  
  return null;
}

/**
 * Validate UUID and throw error if invalid
 */
export function requireValidUUID(uuid: string | undefined | null, errorMessage?: string): string {
  const valid = validateRouteUUID(uuid);
  
  if (!valid) {
    throw new Error(errorMessage || `Invalid UUID format: ${uuid}`);
  }
  
  return valid;
}

/**
 * Safe UUID extraction from URL params
 * Returns null if invalid, preventing database errors
 */
export function extractUUIDFromParams(params: Record<string, string | undefined>, key: string): string | null {
  const value = params[key];
  return validateRouteUUID(value);
}

/**
 * Validate array of UUIDs
 */
export function validateUUIDArray(uuids: (string | null | undefined)[]): string[] {
  return uuids
    .map(uuid => validateRouteUUID(uuid))
    .filter((uuid): uuid is string => uuid !== null);
}

