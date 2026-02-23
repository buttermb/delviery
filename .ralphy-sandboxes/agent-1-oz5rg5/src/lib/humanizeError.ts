/**
 * Humanize Error Messages
 *
 * Converts raw Supabase/PostgreSQL error messages into user-friendly text.
 * Used in toast.error() calls to avoid exposing technical details to users.
 *
 * Usage:
 *   import { humanizeError } from '@/lib/humanizeError';
 *   toast.error(humanizeError(error));
 *   toast.error('Failed to save', { description: humanizeError(error) });
 */

/** Pattern-to-message mapping for common database/API errors */
const ERROR_PATTERNS: ReadonlyArray<{ pattern: string; message: string }> = [
  // Duplicate / unique constraint violations
  { pattern: 'duplicate key value', message: 'This entry already exists. Please use a different value.' },
  { pattern: 'unique constraint', message: 'This entry already exists. Please use a different value.' },
  { pattern: 'already exists', message: 'This entry already exists.' },
  { pattern: 'unique_violation', message: 'A record with these details already exists.' },

  // Foreign key violations
  { pattern: 'violates foreign key constraint', message: 'This item is referenced by other records and cannot be modified.' },
  { pattern: 'foreign key violation', message: 'The referenced item no longer exists. Please refresh and try again.' },
  { pattern: 'is still referenced', message: 'This item is in use and cannot be deleted.' },

  // Not null violations
  { pattern: 'violates not-null constraint', message: 'A required field is missing. Please fill in all required fields.' },
  { pattern: 'null value in column', message: 'A required field is missing. Please fill in all required fields.' },

  // Check constraint violations
  { pattern: 'violates check constraint', message: 'The value entered is not valid. Please check your input.' },

  // Permission / RLS errors
  { pattern: 'new row violates row-level security', message: 'You do not have permission to perform this action.' },
  { pattern: 'permission denied', message: 'You do not have permission to perform this action.' },
  { pattern: 'insufficient_privilege', message: 'You do not have permission to perform this action.' },
  { pattern: 'not authorized', message: 'You are not authorized to perform this action.' },

  // Auth / session errors
  { pattern: 'JWT expired', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'jwt expired', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'invalid jwt', message: 'Your session is invalid. Please sign in again.' },
  { pattern: 'token expired', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'refresh_token_not_found', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'invalid claim', message: 'Your session is invalid. Please sign in again.' },

  // Network errors
  { pattern: 'failed to fetch', message: 'Unable to connect to the server. Please check your connection and try again.' },
  { pattern: 'network error', message: 'A network error occurred. Please check your connection and try again.' },
  { pattern: 'networkerror', message: 'A network error occurred. Please check your connection and try again.' },
  { pattern: 'load failed', message: 'Unable to connect to the server. Please try again.' },
  { pattern: 'ERR_NETWORK', message: 'A network error occurred. Please check your connection.' },

  // Timeout errors
  { pattern: 'timeout', message: 'The request timed out. Please try again.' },
  { pattern: 'statement timeout', message: 'The operation took too long. Please try again.' },
  { pattern: 'canceling statement due to', message: 'The operation took too long. Please try again.' },

  // Rate limiting
  { pattern: 'rate limit', message: 'Too many requests. Please wait a moment and try again.' },
  { pattern: 'too many requests', message: 'Too many requests. Please wait a moment and try again.' },
  { pattern: '429', message: 'Too many requests. Please wait a moment and try again.' },

  // Storage errors
  { pattern: 'payload too large', message: 'The file is too large. Please use a smaller file.' },
  { pattern: 'bucket not found', message: 'Storage is not configured correctly. Please contact support.' },
  { pattern: 'object not found', message: 'The file was not found. It may have been deleted.' },

  // Data type / validation errors
  { pattern: 'invalid input syntax', message: 'The value entered is not in the correct format.' },
  { pattern: 'value too long', message: 'The value entered is too long. Please shorten it.' },
  { pattern: 'out of range', message: 'The number entered is out of the allowed range.' },
  { pattern: 'invalid text representation', message: 'The value entered is not in the correct format.' },

  // Relation / table errors (sanitize DB structure details)
  { pattern: 'relation', message: 'A database error occurred. Please try again or contact support.' },
  { pattern: 'column', message: 'A database error occurred. Please try again or contact support.' },
];

/**
 * Convert a raw error into a human-readable message suitable for toast display.
 *
 * @param error - The raw error (unknown type from catch blocks)
 * @param fallback - Optional fallback message if no pattern matches
 * @returns A human-readable error string
 */
export function humanizeError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const rawMessage = extractMessage(error);

  if (!rawMessage) {
    return fallback;
  }

  const lowerMessage = rawMessage.toLowerCase();

  for (const { pattern, message } of ERROR_PATTERNS) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return message;
    }
  }

  // If the raw message looks like a user-friendly message (no technical jargon), return it
  if (isUserFriendlyMessage(rawMessage)) {
    return rawMessage;
  }

  return fallback;
}

/** Extract raw message string from various error shapes */
function extractMessage(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return undefined;
}

/**
 * Heuristic: a message is likely user-friendly if it doesn't contain
 * common technical indicators from database/API errors.
 */
function isUserFriendlyMessage(message: string): boolean {
  const technicalIndicators = [
    'violates', 'constraint', 'relation', 'column', 'schema',
    'syntax', 'postgresql', 'supabase', 'postgrest', 'pgrst',
    'function', 'operator', 'cast', 'type', 'index', 'table',
    'row-level security', 'rls', 'policy', 'trigger',
    'stack trace', 'at line', 'error code', 'SQLSTATE',
    'undefined', 'null', 'NaN', '{}', '[]',
  ];

  const lower = message.toLowerCase();
  return !technicalIndicators.some(indicator => lower.includes(indicator));
}
