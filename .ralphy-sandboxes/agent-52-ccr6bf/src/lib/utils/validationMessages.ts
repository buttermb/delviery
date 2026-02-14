/**
 * Standardized validation error messages with examples
 * Provides clear, actionable feedback for form validation errors
 */

export const ValidationMessages = {
  // Email errors
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Please enter a valid email (example: user@domain.com)',
  EMAIL_TAKEN: 'This email is already in use. Try a different one or sign in.',

  // Password errors
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_SHORT: 'Password must be at least 8 characters',
  PASSWORD_WEAK: 'Password must include uppercase, lowercase, number, and special character',
  PASSWORD_MISMATCH: 'Passwords do not match',

  // Phone errors
  PHONE_REQUIRED: 'Phone number is required',
  PHONE_INVALID: 'Please enter a valid phone number (example: 555-123-4567)',
  PHONE_FORMAT: 'Phone must be 10 digits without country code',

  // Name errors
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_SHORT: 'Name must be at least 2 characters',
  NAME_TOO_LONG: 'Name must be less than 100 characters',
  NAME_INVALID: 'Name can only contain letters, spaces, and hyphens',

  // Date errors
  DATE_REQUIRED: 'Date is required',
  DATE_INVALID: 'Please enter a valid date',
  DATE_PAST: 'Date cannot be in the past',
  DATE_FUTURE: 'Date cannot be in the future',
  DATE_TOO_EARLY: 'Date is too early',
  DATE_TOO_LATE: 'Date is too late',

  // Number errors
  NUMBER_REQUIRED: 'This field is required',
  NUMBER_INVALID: 'Please enter a valid number',
  NUMBER_MIN: (min: number) => `Value must be at least ${min}`,
  NUMBER_MAX: (max: number) => `Value must be no more than ${max}`,
  NUMBER_POSITIVE: 'Value must be a positive number',
  NUMBER_INTEGER: 'Value must be a whole number',

  // Currency errors
  CURRENCY_INVALID: 'Please enter a valid amount (example: 19.99)',
  CURRENCY_NEGATIVE: 'Amount cannot be negative',
  CURRENCY_TOO_LARGE: 'Amount exceeds maximum allowed',

  // Selection errors
  SELECTION_REQUIRED: 'Please select an option',
  SELECTION_MIN: (min: number) => `Please select at least ${min} option${min > 1 ? 's' : ''}`,
  SELECTION_MAX: (max: number) => `Please select no more than ${max} option${max > 1 ? 's' : ''}`,

  // File errors
  FILE_REQUIRED: 'Please upload a file',
  FILE_TOO_LARGE: (maxMB: number) => `File must be smaller than ${maxMB}MB`,
  FILE_TYPE_INVALID: (types: string[]) => `File must be one of: ${types.join(', ')}`,
  FILE_UPLOAD_FAILED: 'File upload failed. Please try again.',

  // URL errors
  URL_INVALID: 'Please enter a valid URL (example: https://example.com)',
  URL_REQUIRED: 'URL is required',

  // Generic errors
  REQUIRED: 'This field is required',
  INVALID: 'This value is invalid',
  TOO_SHORT: (min: number) => `Must be at least ${min} characters`,
  TOO_LONG: (max: number) => `Must be no more than ${max} characters`,
  PATTERN_MISMATCH: 'Value does not match required pattern',

  // API errors
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
} as const;

/**
 * Get a user-friendly error message from a validation error
 */
export function getValidationMessage(
  errorCode: keyof typeof ValidationMessages | string,
  params?: Record<string, any>
): string {
  const message = ValidationMessages[errorCode as keyof typeof ValidationMessages];

  if (!message) {
    return errorCode; // Return the code itself if not found
  }

  if (typeof message === 'function') {
    // Handle dynamic messages
    const param = Object.values(params || {})[0];
    return message(param);
  }

  return message;
}

/**
 * Parse Zod errors into user-friendly messages
 */
export function parseZodErrors(
  errors: Array<{ path: string[]; message: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const error of errors) {
    const field = error.path.join('.');
    // Use our standardized messages if they match, otherwise use Zod's message
    result[field] = getValidationMessage(error.message as any) || error.message;
  }

  return result;
}

/**
 * Error summary component helper
 * Returns an array of errors for display
 */
export interface ErrorSummaryItem {
  field: string;
  message: string;
  scrollTo: () => void;
}

export function createErrorSummary(
  errors: Record<string, string>,
  fieldRefs?: Record<string, HTMLElement | null>
): ErrorSummaryItem[] {
  return Object.entries(errors).map(([field, message]) => ({
    field,
    message,
    scrollTo: () => {
      const element = fieldRefs?.[field] || document.getElementById(field);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    },
  }));
}

/**
 * Field label helper - adds required indicator
 */
export function formatFieldLabel(label: string, required: boolean): string {
  return required ? `${label} *` : label;
}

export default ValidationMessages;
