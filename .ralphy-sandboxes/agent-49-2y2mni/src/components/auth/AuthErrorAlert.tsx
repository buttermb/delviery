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

/**
 * Helper function to get a user-friendly error message
 */
export function getAuthErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'string') {
    return error || fallback;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message) || fallback;
  }
  return fallback;
}
