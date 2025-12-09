/**
 * Enhanced Toast Actions Library
 * 
 * Features:
 * - Undo support for destructive actions
 * - Progress indicator for long-running operations
 * - Clickable toasts that navigate to relevant items
 * - Persistent toasts for critical errors
 */

import { toast, ExternalToast } from 'sonner';
import { logger } from '@/lib/logger';

// Types
interface UndoableAction {
  id: string | number;
  description: string;
  undoFn: () => Promise<void> | void;
  onExpire?: () => Promise<void> | void;
  duration?: number;
}

interface ActionToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  navigate?: string;
  duration?: number;
}

interface ProgressToastOptions {
  message: string;
  onComplete?: () => void;
}

// Track pending undo actions
const pendingUndos = new Map<string | number, NodeJS.Timeout>();

/**
 * Show a toast with undo support for destructive actions
 * 
 * @param message - The message to display
 * @param undoFn - Function to call if user clicks Undo
 * @param options - Additional options
 * @returns The toast ID for manual dismissal
 * 
 * @example
 * ```ts
 * const { undo } = await deleteClient(clientId);
 * showUndoableToast('Client deleted', async () => {
 *   await restoreClient(clientId);
 * });
 * ```
 */
export const showUndoableToast = (
  message: string,
  undoFn: () => Promise<void> | void,
  options?: {
    description?: string;
    duration?: number;
    onExpire?: () => void;
  }
): string | number => {
  const duration = options?.duration ?? 5000;
  
  const toastId = toast(message, {
    description: options?.description,
    duration,
    action: {
      label: 'Undo',
      onClick: async () => {
        try {
          // Cancel the pending action
          const timeout = pendingUndos.get(toastId);
          if (timeout) {
            clearTimeout(timeout);
            pendingUndos.delete(toastId);
          }
          
          // Execute undo
          await undoFn();
          
          toast.success('Action undone', { duration: 2000 });
          logger.info('Toast action undone', { message });
        } catch (error) {
          logger.error('Failed to undo action', { error, message });
          toast.error('Failed to undo action');
        }
      },
    },
  });

  // Track this undo action
  const timeout = setTimeout(() => {
    pendingUndos.delete(toastId);
    options?.onExpire?.();
  }, duration);
  
  pendingUndos.set(toastId, timeout);

  return toastId;
};

/**
 * Show a toast for successful deletion with undo
 */
export const showDeleteToast = (
  itemName: string,
  undoFn: () => Promise<void> | void,
  options?: { onConfirm?: () => void }
): string | number => {
  return showUndoableToast(
    `${itemName} deleted`,
    undoFn,
    {
      description: 'Click undo to restore',
      duration: 5000,
      onExpire: options?.onConfirm,
    }
  );
};

/**
 * Show a toast for archiving with undo
 */
export const showArchiveToast = (
  itemName: string,
  undoFn: () => Promise<void> | void
): string | number => {
  return showUndoableToast(
    `${itemName} archived`,
    undoFn,
    {
      description: 'Click undo to restore',
      duration: 5000,
    }
  );
};

/**
 * Show a clickable toast that navigates to a specific item
 * 
 * @example
 * ```ts
 * showNavigableToast('Order #123 created', {
 *   actionLabel: 'View Order',
 *   navigate: '/admin/orders/123',
 * });
 * ```
 */
export const showNavigableToast = (
  message: string,
  options: ActionToastOptions & { navigate: string }
): string | number => {
  return toast.success(message, {
    duration: options.duration ?? 4000,
    action: {
      label: options.actionLabel ?? 'View',
      onClick: () => {
        // Use window.location for navigation from toast context
        // This works reliably without needing React Router context
        window.location.href = options.navigate;
      },
    },
  });
};

/**
 * Show a toast with a custom action button
 * 
 * @example
 * ```ts
 * showActionToast('Payment recorded', {
 *   actionLabel: 'Send Receipt',
 *   onAction: () => sendReceipt(paymentId),
 * });
 * ```
 */
export const showActionToast = (
  message: string,
  options: ActionToastOptions
): string | number => {
  const toastOptions: ExternalToast = {
    duration: options.duration ?? 4000,
  };

  if (options.onAction || options.navigate) {
    toastOptions.action = {
      label: options.actionLabel ?? 'Action',
      onClick: () => {
        if (options.onAction) {
          options.onAction();
        }
        if (options.navigate) {
          window.location.href = options.navigate;
        }
      },
    };
  }

  return toast.success(message, toastOptions);
};

/**
 * Show a progress toast for long-running operations
 * Returns a controller to update or dismiss the toast
 * 
 * @example
 * ```ts
 * const progress = showProgressToast('Uploading files...');
 * progress.update(50, 'Uploading... 50%');
 * progress.complete('Upload complete!');
 * ```
 */
export const showProgressToast = (
  message: string
): {
  id: string | number;
  update: (percent: number, newMessage?: string) => void;
  complete: (successMessage?: string) => void;
  error: (errorMessage?: string) => void;
} => {
  const id = toast.loading(message);

  return {
    id,
    update: (percent: number, newMessage?: string) => {
      toast.loading(newMessage ?? `${message} (${percent}%)`, { id });
    },
    complete: (successMessage?: string) => {
      toast.success(successMessage ?? 'Complete!', { id, duration: 3000 });
    },
    error: (errorMessage?: string) => {
      toast.error(errorMessage ?? 'Operation failed', { id, duration: 4000 });
    },
  };
};

/**
 * Show a persistent error toast that requires manual dismissal
 * Use for critical errors that need user attention
 */
export const showPersistentErrorToast = (
  message: string,
  options?: {
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  }
): string | number => {
  const toastOptions: ExternalToast = {
    description: options?.description,
    duration: Infinity, // Won't auto-dismiss
  };

  if (options?.onAction) {
    toastOptions.action = {
      label: options.actionLabel ?? 'Retry',
      onClick: options.onAction,
    };
  }

  return toast.error(message, toastOptions);
};

/**
 * Show a toast for batch operations with undo support
 * 
 * @example
 * ```ts
 * showBatchToast(
 *   5,
 *   'items deleted',
 *   async () => restoreItems(itemIds)
 * );
 * ```
 */
export const showBatchToast = (
  count: number,
  action: string,
  undoFn?: () => Promise<void> | void
): string | number => {
  const message = `${count} ${action}`;
  
  if (undoFn) {
    return showUndoableToast(message, undoFn, {
      description: 'Click undo to restore all',
      duration: 6000, // Longer for batch operations
    });
  }

  return toast.success(message, { duration: 3000 });
};

/**
 * Show a success toast for creating a new item with navigation
 */
export const showCreateSuccessToast = (
  itemType: string,
  itemId: string,
  basePath: string
): string | number => {
  return showNavigableToast(
    `${itemType} created successfully`,
    {
      actionLabel: `View ${itemType}`,
      navigate: `${basePath}/${itemId}`,
      duration: 4000,
    }
  );
};

/**
 * Show a toast for copying to clipboard
 */
export const showCopyToast = (itemName?: string): void => {
  toast.success(itemName ? `${itemName} copied to clipboard` : 'Copied to clipboard', {
    duration: 2000,
  });
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = (): void => {
  toast.dismiss();
  // Clear all pending undo timeouts
  pendingUndos.forEach((timeout) => clearTimeout(timeout));
  pendingUndos.clear();
};

/**
 * Cancel a specific pending undo action
 */
export const cancelPendingUndo = (toastId: string | number): void => {
  const timeout = pendingUndos.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    pendingUndos.delete(toastId);
  }
  toast.dismiss(toastId);
};

// Re-export base toast for direct access when needed
export { toast };









