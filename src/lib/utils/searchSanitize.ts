/**
 * Escapes special Postgres LIKE/ILIKE pattern characters (%, _, \)
 * to prevent injection in .ilike() queries.
 */
export function escapePostgresLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Sanitizes user search input for use in Postgres ILIKE queries.
 * Truncates to maxLength and escapes LIKE pattern characters.
 */
export function sanitizeSearchInput(input: string, maxLength = 200): string {
  return escapePostgresLike(input.slice(0, maxLength));
}
