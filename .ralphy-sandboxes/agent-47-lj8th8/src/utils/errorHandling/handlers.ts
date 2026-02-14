import { toast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';
import { getErrorMessage, isAuthError } from './typeGuards';

interface ErrorHandlerOptions {
    /**
     * Component or function name where the error occurred
     */
    component?: string;
    /**
     * Whether to show a toast notification (default: true)
     */
    showToast?: boolean;
    /**
     * Custom title for the toast (default: "Error")
     */
    toastTitle?: string;
    /**
     * Additional context to log with the error
     */
    context?: Record<string, any>;
}

/**
 * Standardized error handler
 * Logs the error and optionally shows a toast notification
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}) {
    const { component = 'unknown', showToast = true, toastTitle = 'Error', context = {} } = options;
    const message = getErrorMessage(error);

    // Log the error
    logger.error(message, error, { component, ...context });

    // Show toast if requested
    if (showToast) {
        // Check for specific error types to provide better messages
        if (isAuthError(error)) {
            // Auth errors are usually user-facing
            toast({
                variant: "destructive",
                title: "Authentication Error",
                description: message,
            });
        } else {
            toast({
                variant: "destructive",
                title: toastTitle,
                description: message,
            });
        }
    }

    return message;
}
