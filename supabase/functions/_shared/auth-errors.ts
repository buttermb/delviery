/**
 * Standardized auth error messages
 * Using consistent messages prevents user enumeration attacks
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account is temporarily locked. Please try again later.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Access denied',
  SESSION_EXPIRED: 'Session expired. Please sign in again.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
} as const;
