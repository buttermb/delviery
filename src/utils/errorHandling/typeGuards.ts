import { PostgrestError } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';

/**
 * Type guard to check if an unknown value is an Error object
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

/**
 * Type guard to check if an unknown value is a PostgrestError (Supabase DB error)
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        'details' in error &&
        'hint' in error &&
        'code' in error
    );
}

/**
 * Type guard to check if an unknown value is an AuthError (Supabase Auth error)
 */
export function isAuthError(error: unknown): error is AuthError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        'status' in error &&
        'name' in error &&
        (error as Record<string, unknown>).name === 'AuthError'
    );
}

/**
 * Type guard to check if an error has a message property
 */
export function hasMessage(error: unknown): error is { message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Helper to safely extract an error message from any unknown value
 */
export function getErrorMessage(error: unknown): string {
    if (isPostgrestError(error)) {
        return error.message;
    }
    if (isAuthError(error)) {
        return error.message;
    }
    if (isError(error)) {
        return error.message;
    }
    if (hasMessage(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unexpected error occurred';
}
