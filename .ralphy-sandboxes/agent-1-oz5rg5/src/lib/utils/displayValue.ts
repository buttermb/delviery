/**
 * Display Value Utilities
 * Handle null/undefined/empty values for UI display
 */

/**
 * Returns the value if present, or a fallback (default: em dash '—')
 * Use this for any field that could be null/undefined when rendering in the UI.
 *
 * @example
 * displayValue(customer.address)     // "123 Main St" or "—"
 * displayValue(order.notes, 'None')  // "Some note" or "None"
 */
export function displayValue(
  value: string | number | null | undefined,
  fallback: string = '—'
): string {
  if (value == null || value === '') return fallback;
  return String(value);
}

/**
 * Safely builds a full name from first/last name parts.
 * Returns the fallback when both parts are missing.
 *
 * @example
 * displayName('John', 'Doe')   // "John Doe"
 * displayName(null, 'Doe')     // "Doe"
 * displayName(null, null)      // "Unknown"
 * displayName('', '')          // "Unknown"
 */
export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string = 'Unknown'
): string {
  const parts = [firstName, lastName].filter(
    (p): p is string => p != null && p !== ''
  );
  return parts.length > 0 ? parts.join(' ') : fallback;
}
