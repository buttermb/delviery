/**
 * Search Input Sanitization
 *
 * Prevents LIKE pattern injection, XSS via search terms,
 * and ensures safe search input handling throughout the app.
 *
 * This is the single source of truth for search sanitization.
 */

/**
 * Escapes special Postgres LIKE/ILIKE pattern characters (%, _, \)
 * to prevent injection in .ilike() queries.
 */
export function escapePostgresLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Strips HTML tags and script-related patterns from input.
 * Prevents XSS when search terms are rendered or stored.
 */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitizes user search input for safe use in Postgres queries.
 * - Returns empty string for null/undefined
 * - Strips leading/trailing whitespace
 * - Removes HTML tags and script patterns (XSS prevention)
 * - Truncates to maxLength
 * - Escapes Postgres LIKE special chars (%, _, \)
 */
export function sanitizeSearchInput(input: string | null | undefined, maxLength = 200): string {
  if (input == null) return '';

  return escapePostgresLike(
    stripHtmlTags(input.trim()).slice(0, maxLength)
  );
}

/**
 * Sanitizes search input and wraps in % for partial ILIKE matching.
 * Returns '%sanitized%' for use in .ilike() calls.
 * Returns '%' for empty/null input (matches everything).
 */
export function sanitizeForIlike(input: string | null | undefined, maxLength = 200): string {
  const sanitized = sanitizeSearchInput(input, maxLength);
  return `%${sanitized}%`;
}

/**
 * Sanitizes input for Postgres full-text search (tsquery).
 * Removes characters that could break tsquery parsing.
 */
export function sanitizeForTextSearch(input: string | null | undefined, maxLength = 200): string {
  if (input == null) return '';

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'";&|!()\\:*]/g, '')
    .replace(/\s+/g, ' ');
}
