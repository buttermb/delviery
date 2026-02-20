/**
 * Auth Error Alert
 * Consistent error message styling with red alert box for all auth forms.
 * Supports light (default) and dark variants to match different form themes.
 */

import { AlertCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AuthErrorType = 'error' | 'warning' | 'credentials' | 'locked' | 'general';

interface AuthErrorAlertProps {
  /** The error message to display */
  message: string;
  /** The type of error for styling and icon selection */
  type?: AuthErrorType;
  /** Visual variant matching the form's design system */
  variant?: 'dark' | 'light';
  /** Optional title shown above the message */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show animation when appearing */
  animate?: boolean;
}

/**
 * Consistent error alert component for auth forms.
 * Displays error messages with appropriate styling and icons.
 */
export function AuthErrorAlert({
  message,
  type = 'error',
  variant = 'light',
  title,
  className,
  animate = true,
}: AuthErrorAlertProps) {
  if (!message) return null;

  // Style variants
  const lightStyles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    credentials: 'bg-red-50 border-red-200 text-red-800',
    locked: 'bg-red-50 border-red-300 text-red-900',
    general: 'bg-red-50 border-red-200 text-red-800',
  };

  const darkStyles = {
    error: 'bg-red-900/30 border-red-700/50 text-red-200',
    warning: 'bg-amber-900/30 border-amber-700/50 text-amber-200',
    credentials: 'bg-red-900/30 border-red-700/50 text-red-200',
    locked: 'bg-red-900/40 border-red-600/50 text-red-100',
    general: 'bg-red-900/30 border-red-700/50 text-red-200',
  };

  const styles = variant === 'dark' ? darkStyles : lightStyles;
  const variantStyles = styles[type] || styles.error;

  // Icon selection based on error type
  const Icon = type === 'warning' ? AlertTriangle : type === 'locked' ? XCircle : AlertCircle;
  const iconColor = variant === 'dark'
    ? type === 'warning' ? 'text-amber-400' : 'text-red-400'
    : type === 'warning' ? 'text-amber-600' : 'text-red-600';

  // Title color
  const titleColor = variant === 'dark'
    ? type === 'warning' ? 'text-amber-100' : 'text-red-100'
    : type === 'warning' ? 'text-amber-900' : 'text-red-900';

  // Description color for secondary text
  const descriptionColor = variant === 'dark'
    ? type === 'warning' ? 'text-amber-300' : 'text-red-300'
    : type === 'warning' ? 'text-amber-700' : 'text-red-700';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        variantStyles,
        animate && 'animate-in fade-in-0 slide-in-from-top-1 duration-200',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon
        className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor)}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('font-semibold text-sm mb-1', titleColor)}>
            {title}
          </p>
        )}
        <p className={cn('text-sm', title ? descriptionColor : '')}>
          {message}
        </p>
      </div>
    </div>
  );
}

/**
 * Helper function to determine error type from error message
 */
export function getAuthErrorType(message: string): AuthErrorType {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('locked') ||
    lowerMessage.includes('suspended') ||
    lowerMessage.includes('disabled') ||
    lowerMessage.includes('blocked')
  ) {
    return 'locked';
  }

  if (
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('credentials') ||
    lowerMessage.includes('incorrect') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('wrong password') ||
    lowerMessage.includes('email or password')
  ) {
    return 'credentials';
  }

  if (
    lowerMessage.includes('warning') ||
    lowerMessage.includes('caution')
  ) {
    return 'warning';
  }

  return 'general';
}

/** Known Supabase auth error patterns mapped to user-friendly messages */
const AUTH_ERROR_MAP: ReadonlyArray<{ pattern: string; message: string }> = [
  // Credential errors — never reveal which field is wrong
  { pattern: 'invalid login credentials', message: 'Invalid email or password. Please check your credentials and try again.' },
  { pattern: 'invalid credentials', message: 'Invalid email or password. Please check your credentials and try again.' },
  { pattern: 'wrong password', message: 'Invalid email or password. Please check your credentials and try again.' },
  { pattern: 'user not found', message: 'Invalid email or password. Please check your credentials and try again.' },
  { pattern: 'no user found', message: 'Invalid email or password. Please check your credentials and try again.' },

  // Email confirmation
  { pattern: 'email not confirmed', message: 'Please verify your email address before signing in. Check your inbox for a verification link.' },

  // Account state
  { pattern: 'user already registered', message: 'An account with this email already exists. Please sign in instead.' },
  { pattern: 'user banned', message: 'Your account has been suspended. Please contact support for assistance.' },
  { pattern: 'user disabled', message: 'Your account has been disabled. Please contact your administrator.' },

  // Rate limiting
  { pattern: 'too many requests', message: 'Too many login attempts. Please wait a moment and try again.' },
  { pattern: 'rate limit', message: 'Too many login attempts. Please wait a moment and try again.' },

  // Session / token
  { pattern: 'jwt expired', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'token expired', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'refresh_token_not_found', message: 'Your session has expired. Please sign in again.' },
  { pattern: 'invalid jwt', message: 'Your session is invalid. Please sign in again.' },

  // Network
  { pattern: 'failed to fetch', message: 'Unable to connect to the server. Please check your connection and try again.' },
  { pattern: 'network error', message: 'A network error occurred. Please check your connection and try again.' },
  { pattern: 'load failed', message: 'Unable to connect to the server. Please try again.' },
];

/**
 * Helper function to get a user-friendly error message.
 * Maps known Supabase auth errors to human-readable text so raw
 * technical messages are never shown to users.
 */
export function getAuthErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  const rawMessage = extractAuthErrorMessage(error);

  if (!rawMessage) {
    return fallback;
  }

  const lowerMessage = rawMessage.toLowerCase();

  for (const { pattern, message } of AUTH_ERROR_MAP) {
    if (lowerMessage.includes(pattern)) {
      return message;
    }
  }

  // If the message looks user-friendly (no technical jargon), allow it through
  if (isUserFriendlyAuthMessage(rawMessage)) {
    return rawMessage;
  }

  return fallback;
}

/** Extract the raw message string from various error shapes */
function extractAuthErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return undefined;
}

/** Heuristic: message is user-friendly if it lacks technical indicators */
function isUserFriendlyAuthMessage(message: string): boolean {
  const technicalIndicators = [
    'supabase', 'postgrest', 'pgrst', 'postgresql',
    'jwt', 'token', 'schema', 'relation', 'column',
    'constraint', 'syntax', 'stack trace', 'SQLSTATE',
    'AuthApiError', 'AuthRetryableFetchError',
  ];
  const lower = message.toLowerCase();
  return !technicalIndicators.some(indicator => lower.includes(indicator));
}
