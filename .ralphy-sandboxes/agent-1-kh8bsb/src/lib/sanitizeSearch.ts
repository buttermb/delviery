/**
 * Search input sanitization for Postgres ILIKE queries.
 * Prevents LIKE pattern injection by escaping special characters.
 */

/**
 * Sanitizes user search input for safe use in Postgres queries.
 * - Strips leading/trailing whitespace
 * - Escapes Postgres LIKE special chars (%, _, \)
 * - Limits to 100 characters
 * - Returns empty string for null/undefined
 */
export function sanitizeSearchInput(input: string | null | undefined): string {
  if (input == null) return '';

  return input
    .trim()
    .slice(0, 100)
    .replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitizes search input and wraps in % for partial ILIKE matching.
 * Returns '%sanitized%' for use in .ilike() calls.
 * Returns '%' for empty/null input (matches everything).
 */
export function sanitizeForIlike(input: string | null | undefined): string {
  const sanitized = sanitizeSearchInput(input);
  return `%${sanitized}%`;
}
