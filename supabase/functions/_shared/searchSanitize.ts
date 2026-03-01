/**
 * Search Input Sanitization for Edge Functions
 *
 * Prevents LIKE pattern injection and XSS in search inputs.
 * Mirrors the frontend utility at src/lib/utils/searchSanitize.ts.
 */

/**
 * Escapes special Postgres LIKE/ILIKE pattern characters (%, _, \).
 */
export function escapePostgresLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Strips HTML tags and script-related patterns from input.
 */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitizes user search input for safe use in Postgres queries.
 */
export function sanitizeSearchInput(input: string | null | undefined, maxLength = 200): string {
  if (input == null) return '';

  return escapePostgresLike(
    stripHtmlTags(input.trim()).slice(0, maxLength)
  );
}

/**
 * Sanitizes search input and wraps in % for partial ILIKE matching.
 */
export function sanitizeForIlike(input: string | null | undefined, maxLength = 200): string {
  const sanitized = sanitizeSearchInput(input, maxLength);
  return `%${sanitized}%`;
}
