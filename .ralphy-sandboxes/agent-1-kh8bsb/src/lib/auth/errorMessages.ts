/**
 * Auth Error Messages
 *
 * Maps Supabase/GoTrue auth error codes to user-friendly messages.
 * Designed for internationalization (i18n) — all messages are stored
 * as string keys that can be swapped for translation lookups.
 */

/** Supported error code identifiers from Supabase Auth / GoTrue */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'user_already_registered'
  | 'email_exists'
  | 'weak_password'
  | 'expired_token'
  | 'otp_expired'
  | 'refresh_token_expired'
  | 'account_locked'
  | 'user_banned'
  | 'rate_limited'
  | 'too_many_requests'
  | 'network_error'
  | 'email_not_confirmed'
  | 'phone_not_confirmed'
  | 'signup_disabled'
  | 'user_not_found'
  | 'session_expired'
  | 'invalid_otp'
  | 'unknown';

/** Structure for a user-facing error message with optional recovery hint */
export interface AuthErrorMessage {
  /** i18n key for the error title/message */
  messageKey: string;
  /** Fallback English message (used when i18n is not configured) */
  defaultMessage: string;
  /** Optional recovery suggestion for the user */
  recoveryHint?: string;
}

/**
 * Mapping of auth error codes to user-friendly messages.
 * Each entry provides an i18n key, a default English string,
 * and an optional recovery hint.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, AuthErrorMessage> = {
  invalid_credentials: {
    messageKey: 'auth.error.invalidCredentials',
    defaultMessage: 'Invalid email or password. Please check your credentials and try again.',
    recoveryHint: 'Double-check your email address and password.',
  },
  user_already_registered: {
    messageKey: 'auth.error.emailExists',
    defaultMessage: 'An account with this email already exists.',
    recoveryHint: 'Try logging in instead, or use a different email address.',
  },
  email_exists: {
    messageKey: 'auth.error.emailExists',
    defaultMessage: 'An account with this email already exists.',
    recoveryHint: 'Try logging in instead, or use a different email address.',
  },
  weak_password: {
    messageKey: 'auth.error.weakPassword',
    defaultMessage: 'Password is too weak. It must be at least 8 characters with a mix of letters, numbers, and symbols.',
    recoveryHint: 'Use a stronger password with uppercase, lowercase, numbers, and special characters.',
  },
  expired_token: {
    messageKey: 'auth.error.expiredToken',
    defaultMessage: 'Your session has expired. Please log in again.',
    recoveryHint: 'Log in again to continue.',
  },
  otp_expired: {
    messageKey: 'auth.error.otpExpired',
    defaultMessage: 'The verification code has expired. Please request a new one.',
    recoveryHint: 'Request a new verification code.',
  },
  refresh_token_expired: {
    messageKey: 'auth.error.refreshTokenExpired',
    defaultMessage: 'Your session has expired. Please log in again.',
    recoveryHint: 'Log in again to continue.',
  },
  account_locked: {
    messageKey: 'auth.error.accountLocked',
    defaultMessage: 'Your account has been locked due to too many failed attempts. Please try again later or contact support.',
    recoveryHint: 'Wait a few minutes before trying again, or reset your password.',
  },
  user_banned: {
    messageKey: 'auth.error.userBanned',
    defaultMessage: 'Your account has been suspended. Please contact support for assistance.',
    recoveryHint: 'Contact support for more information.',
  },
  rate_limited: {
    messageKey: 'auth.error.rateLimited',
    defaultMessage: 'Too many requests. Please wait a moment before trying again.',
    recoveryHint: 'Wait a few seconds and try again.',
  },
  too_many_requests: {
    messageKey: 'auth.error.rateLimited',
    defaultMessage: 'Too many requests. Please wait a moment before trying again.',
    recoveryHint: 'Wait a few seconds and try again.',
  },
  network_error: {
    messageKey: 'auth.error.networkError',
    defaultMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
    recoveryHint: 'Check your internet connection.',
  },
  email_not_confirmed: {
    messageKey: 'auth.error.emailNotConfirmed',
    defaultMessage: 'Please verify your email address before logging in.',
    recoveryHint: 'Check your inbox for a verification email.',
  },
  phone_not_confirmed: {
    messageKey: 'auth.error.phoneNotConfirmed',
    defaultMessage: 'Please verify your phone number before logging in.',
    recoveryHint: 'Complete phone verification to continue.',
  },
  signup_disabled: {
    messageKey: 'auth.error.signupDisabled',
    defaultMessage: 'New account registration is currently disabled.',
    recoveryHint: 'Contact your administrator for access.',
  },
  user_not_found: {
    messageKey: 'auth.error.userNotFound',
    defaultMessage: 'No account found with this email address.',
    recoveryHint: 'Check your email address or create a new account.',
  },
  session_expired: {
    messageKey: 'auth.error.sessionExpired',
    defaultMessage: 'Your session has expired. Please log in again.',
    recoveryHint: 'Log in again to continue.',
  },
  invalid_otp: {
    messageKey: 'auth.error.invalidOtp',
    defaultMessage: 'The verification code is invalid. Please check and try again.',
    recoveryHint: 'Enter the correct code or request a new one.',
  },
  unknown: {
    messageKey: 'auth.error.unknown',
    defaultMessage: 'An unexpected error occurred. Please try again.',
    recoveryHint: 'If the problem persists, contact support.',
  },
};

/**
 * Known error message substrings from Supabase/GoTrue mapped to error codes.
 * Used for matching raw error strings when a structured code is not available.
 */
const ERROR_MESSAGE_PATTERNS: ReadonlyArray<{ pattern: string; code: AuthErrorCode }> = [
  { pattern: 'invalid login credentials', code: 'invalid_credentials' },
  { pattern: 'invalid authentication credentials', code: 'invalid_credentials' },
  { pattern: 'email not confirmed', code: 'email_not_confirmed' },
  { pattern: 'phone not confirmed', code: 'phone_not_confirmed' },
  { pattern: 'user already registered', code: 'user_already_registered' },
  { pattern: 'already been registered', code: 'user_already_registered' },
  { pattern: 'email already in use', code: 'email_exists' },
  { pattern: 'password should be', code: 'weak_password' },
  { pattern: 'password is too short', code: 'weak_password' },
  { pattern: 'password is too weak', code: 'weak_password' },
  { pattern: 'token expired', code: 'expired_token' },
  { pattern: 'token is expired', code: 'expired_token' },
  { pattern: 'refresh token', code: 'refresh_token_expired' },
  { pattern: 'otp expired', code: 'otp_expired' },
  { pattern: 'otp is expired', code: 'otp_expired' },
  { pattern: 'invalid otp', code: 'invalid_otp' },
  { pattern: 'rate limit', code: 'rate_limited' },
  { pattern: 'too many requests', code: 'too_many_requests' },
  { pattern: 'user banned', code: 'user_banned' },
  { pattern: 'user not found', code: 'user_not_found' },
  { pattern: 'signups not allowed', code: 'signup_disabled' },
  { pattern: 'signup is disabled', code: 'signup_disabled' },
  { pattern: 'network', code: 'network_error' },
  { pattern: 'fetch failed', code: 'network_error' },
  { pattern: 'failed to fetch', code: 'network_error' },
  { pattern: 'account is locked', code: 'account_locked' },
  { pattern: 'locked out', code: 'account_locked' },
];

/**
 * Optional i18n translation function type.
 * When provided, messages will be resolved via this function
 * using the messageKey from the error mapping.
 */
export type TranslateFn = (key: string, fallback?: string) => string;

/**
 * Get a user-friendly error message for a given auth error.
 *
 * Resolution order:
 * 1. Match by structured error code (if provided)
 * 2. Match by error message substring patterns
 * 3. Fall back to 'unknown' error
 *
 * @param error - The error object or message string from auth operations
 * @param translate - Optional i18n translation function
 * @returns User-friendly error message string
 */
export function getAuthErrorMessage(
  error: { message?: string; code?: string; status?: number } | string | unknown,
  translate?: TranslateFn
): string {
  const { code, message } = normalizeError(error);

  // 1. Try matching by explicit error code
  if (code && code in AUTH_ERROR_MESSAGES) {
    const entry = AUTH_ERROR_MESSAGES[code as AuthErrorCode];
    return translate
      ? translate(entry.messageKey, entry.defaultMessage)
      : entry.defaultMessage;
  }

  // 2. Try matching by status code
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) {
      const entry = AUTH_ERROR_MESSAGES.rate_limited;
      return translate
        ? translate(entry.messageKey, entry.defaultMessage)
        : entry.defaultMessage;
    }
  }

  // 3. Try matching by message substring patterns
  if (message) {
    const lowerMessage = message.toLowerCase();
    for (const { pattern, code: matchedCode } of ERROR_MESSAGE_PATTERNS) {
      if (lowerMessage.includes(pattern)) {
        const entry = AUTH_ERROR_MESSAGES[matchedCode];
        return translate
          ? translate(entry.messageKey, entry.defaultMessage)
          : entry.defaultMessage;
      }
    }
  }

  // 4. Fall back to unknown error
  const fallbackEntry = AUTH_ERROR_MESSAGES.unknown;
  return translate
    ? translate(fallbackEntry.messageKey, fallbackEntry.defaultMessage)
    : fallbackEntry.defaultMessage;
}

/**
 * Get the full error details including recovery hint.
 *
 * @param error - The error object or message string
 * @param translate - Optional i18n translation function
 * @returns Full error message details with recovery hint
 */
export function getAuthErrorDetails(
  error: { message?: string; code?: string; status?: number } | string | unknown,
  translate?: TranslateFn
): AuthErrorMessage {
  const { code, message } = normalizeError(error);

  // 1. Try matching by explicit error code
  if (code && code in AUTH_ERROR_MESSAGES) {
    const entry = AUTH_ERROR_MESSAGES[code as AuthErrorCode];
    return resolveEntry(entry, translate);
  }

  // 2. Try matching by status code
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) {
      return resolveEntry(AUTH_ERROR_MESSAGES.rate_limited, translate);
    }
  }

  // 3. Try matching by message substring patterns
  if (message) {
    const lowerMessage = message.toLowerCase();
    for (const { pattern, code: matchedCode } of ERROR_MESSAGE_PATTERNS) {
      if (lowerMessage.includes(pattern)) {
        return resolveEntry(AUTH_ERROR_MESSAGES[matchedCode], translate);
      }
    }
  }

  // 4. Fall back to unknown error
  return resolveEntry(AUTH_ERROR_MESSAGES.unknown, translate);
}

/** Normalize varied error input shapes into a consistent format */
function normalizeError(error: unknown): { code?: string; message?: string } {
  if (typeof error === 'string') {
    return { message: error };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'code' in error ? String((error as { code: unknown }).code) : undefined,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: typeof obj.message === 'string' ? obj.message : undefined,
      code: typeof obj.code === 'string' ? obj.code : undefined,
    };
  }
  return {};
}

/** Resolve an entry with optional i18n translation */
function resolveEntry(entry: AuthErrorMessage, translate?: TranslateFn): AuthErrorMessage {
  if (!translate) {
    return entry;
  }
  return {
    messageKey: entry.messageKey,
    defaultMessage: translate(entry.messageKey, entry.defaultMessage),
    recoveryHint: entry.recoveryHint,
  };
}
