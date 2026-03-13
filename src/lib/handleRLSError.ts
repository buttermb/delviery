/**
 * handleRLSError Utility
 *
 * Detects and formats Supabase Row Level Security (RLS) errors into user-friendly messages.
 * Use this in catch blocks to provide helpful feedback when RLS policies deny access.
 */

import { logger } from '@/lib/logger';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Check if an error is an RLS permission error
 * RLS errors typically have:
 * - code: '42501' (insufficient_privilege) or 'PGRST301' (Postgrest RLS violation)
 * - message containing "policy" or "permission"
 */
export function isRLSError(error: unknown): boolean {
  if (!error) return false;

  // Check for Supabase/Postgrest error structure
  const pgError = error as PostgrestError;

  if (pgError.code === '42501') {
    // PostgreSQL insufficient_privilege error
    return true;
  }

  if (pgError.code === 'PGRST301') {
    // Postgrest RLS violation
    return true;
  }

  // Check message for RLS-related keywords
  const message = pgError.message?.toLowerCase() || '';
  const details = pgError.details?.toLowerCase() || '';
  const hint = pgError.hint?.toLowerCase() || '';

  const rlsKeywords = [
    'policy',
    'row-level security',
    'rls',
    'permission denied',
    'insufficient privilege',
    'access denied',
  ];

  return rlsKeywords.some(keyword =>
    message.includes(keyword) ||
    details.includes(keyword) ||
    hint.includes(keyword)
  );
}

/**
 * Format RLS errors into user-friendly messages
 * Returns a specific message based on the operation type
 */
export function handleRLSError(
  error: unknown,
  options?: {
    /** The operation being attempted (e.g., 'view', 'create', 'update', 'delete') */
    operation?: 'view' | 'create' | 'update' | 'delete';
    /** The resource type (e.g., 'order', 'product', 'customer') */
    resource?: string;
    /** Custom fallback message */
    fallbackMessage?: string;
  }
): string {
  const { operation = 'access', resource = 'this data', fallbackMessage } = options || {};

  // Log the full error for debugging
  logger.warn('RLS error detected', { error, operation, resource });

  // If it's not an RLS error, return the fallback or a generic message
  if (!isRLSError(error)) {
    if (fallbackMessage) {
      return fallbackMessage;
    }

    // Try to extract a meaningful message from the error
    const pgError = error as PostgrestError;
    if (pgError.message) {
      return pgError.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  // Format user-friendly RLS error messages based on operation
  const messages: Record<string, string> = {
    view: `You don't have permission to view ${resource}.`,
    create: `You don't have permission to create ${resource}.`,
    update: `You don't have permission to update ${resource}.`,
    delete: `You don't have permission to delete ${resource}.`,
    access: `You don't have permission to access ${resource}.`,
  };

  return messages[operation] || messages.access;
}

/**
 * Get a helpful suggestion for resolving RLS errors
 */
export function getRLSErrorSuggestion(operation?: string): string {
  const suggestions: Record<string, string> = {
    view: 'Contact your administrator to request read access.',
    create: 'Contact your administrator to request create permissions.',
    update: 'Contact your administrator to request edit permissions.',
    delete: 'Contact your administrator to request delete permissions.',
  };

  return suggestions[operation || 'access'] || 'Contact your administrator to request the necessary permissions.';
}
