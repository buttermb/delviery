/**
 * Phone Number Formatting & Normalization Utilities
 * Consistent phone number display and storage across the app
 */

/**
 * Normalize a phone number to 10-digit US format (digits only).
 * Strips all non-digit characters, removes leading country code (+1 or 1).
 * Returns null if the result is not exactly 10 digits.
 *
 * @example
 * normalizePhoneNumber('(555) 123-4567')   → '5551234567'
 * normalizePhoneNumber('+1 555-123-4567')  → '5551234567'
 * normalizePhoneNumber('15551234567')      → '5551234567'
 * normalizePhoneNumber('5551234567')       → '5551234567'
 * normalizePhoneNumber('123')              → null
 * normalizePhoneNumber('')                 → null
 */
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;

  let digits = value.replace(/\D/g, '');

  // Strip leading US country code
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  return digits.length === 10 ? digits : null;
}

/**
 * Format a phone number as the user types for a natural input experience.
 * Progressively formats: 5 → 55 → 555 → (555) → (555) 1 → (555) 12 → (555) 123 → (555) 123-4 → (555) 123-4567
 *
 * @example
 * formatPhoneInput('555')       → '(555'
 * formatPhoneInput('5551')      → '(555) 1'
 * formatPhoneInput('555123')    → '(555) 123'
 * formatPhoneInput('5551234')   → '(555) 123-4'
 * formatPhoneInput('5551234567')→ '(555) 123-4567'
 */
export function formatPhoneInput(value: string): string {
  // Strip everything except digits
  let digits = value.replace(/\D/g, '');

  // Strip leading country code if user types +1 or 1 followed by 10 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  // Cap at 10 digits
  if (digits.length > 10) {
    digits = digits.slice(0, 10);
  }

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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
