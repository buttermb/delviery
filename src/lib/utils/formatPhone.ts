/**
 * Phone Number Formatting Utilities
 * Consistent phone number display across the app
 */

/**
 * Format a phone number for display as (XXX) XXX-XXXX
 * Handles 10-digit US numbers, 11-digit with leading 1, and passes through others unchanged.
 *
 * @example
 * formatPhoneNumber('5551234567')       → '(555) 123-4567'
 * formatPhoneNumber('15551234567')      → '(555) 123-4567'
 * formatPhoneNumber('+15551234567')     → '(555) 123-4567'
 * formatPhoneNumber('555-123-4567')     → '(555) 123-4567'
 * formatPhoneNumber('(555) 123-4567')   → '(555) 123-4567'
 * formatPhoneNumber(null)               → '—'
 * formatPhoneNumber('')                 → '—'
 * formatPhoneNumber('+44 20 7946 0958') → '+44 20 7946 0958' (non-US, pass through)
 */
export function formatPhoneNumber(
  value: string | null | undefined,
  options?: { fallback?: string }
): string {
  const { fallback = '—' } = options || {};

  if (!value || value.trim() === '') {
    return fallback;
  }

  // Strip all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Handle 11-digit US numbers (leading 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    return `(${area}) ${prefix}-${line}`;
  }

  // Non-US or unrecognized format — return original trimmed value
  return value.trim();
}
