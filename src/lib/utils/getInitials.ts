/**
 * Extract initials from a name string.
 * Falls back to email first character if name is empty.
 *
 * @param name - Full name, first name, or display name
 * @param email - Optional email fallback
 * @param fallback - Optional fallback string when both name and email are empty (default: '?')
 * @returns 1-2 character uppercase initials string
 */
export function getInitials(
  name: string | null | undefined,
  email?: string | null,
  fallback = '?',
): string {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return fallback;
}
