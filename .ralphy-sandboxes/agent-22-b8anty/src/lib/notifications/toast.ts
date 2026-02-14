/**
 * Shared Toast Notification Utility
 *
 * Wraps sonner toast with standardized messages for common actions.
 * Provides consistent messaging across all modules.
 *
 * Usage:
 *   import { toastOrderCreated, toastInventoryLow, toastError } from '@/lib/notifications/toast';
 *
 *   toastOrderCreated('ORD-12345');
 *   toastInventoryLow('Blue Dream', 5);
 *   toastError('save order', new Error('Network error'));
 */

import { toast, ExternalToast } from 'sonner';

// ============================================================================
// Order Notifications
// ============================================================================

/**
 * Toast for successful order creation
 */
export function toastOrderCreated(orderNumber: string, options?: ExternalToast): void {
  toast.success(`Order ${orderNumber} created`, {
    description: 'Order has been successfully placed',
    ...options,
  });
}

/**
 * Toast for order status update
 */
export function toastOrderUpdated(orderNumber: string, status: string, options?: ExternalToast): void {
  toast.success(`Order ${orderNumber} updated`, {
    description: `Status changed to ${status}`,
    ...options,
  });
}

/**
 * Toast for order cancellation
 */
export function toastOrderCancelled(orderNumber: string, options?: ExternalToast): void {
  toast.info(`Order ${orderNumber} cancelled`, {
    description: 'Order has been cancelled successfully',
    ...options,
  });
}

/**
 * Toast for order completion
 */
export function toastOrderCompleted(orderNumber: string, options?: ExternalToast): void {
  toast.success(`Order ${orderNumber} completed`, {
    description: 'Order has been fulfilled and marked complete',
    ...options,
  });
}

/**
 * Toast for order delivery
 */
export function toastOrderDelivered(orderNumber: string, options?: ExternalToast): void {
  toast.success(`Order ${orderNumber} delivered`, {
    description: 'Order has been successfully delivered',
    ...options,
  });
}

// ============================================================================
// Inventory Notifications
// ============================================================================

/**
 * Toast for low inventory warning
 */
export function toastInventoryLow(productName: string, quantity: number, options?: ExternalToast): void {
  toast.warning(`Low stock: ${productName}`, {
    description: `Only ${quantity} units remaining`,
    ...options,
  });
}

/**
 * Toast for inventory update
 */
export function toastInventoryUpdated(productName: string, options?: ExternalToast): void {
  toast.success(`Inventory updated`, {
    description: `${productName} stock has been updated`,
    ...options,
  });
}

/**
 * Toast for out of stock
 */
export function toastOutOfStock(productName: string, options?: ExternalToast): void {
  toast.error(`Out of stock: ${productName}`, {
    description: 'Product is no longer available',
    ...options,
  });
}

/**
 * Toast for inventory sync
 */
export function toastInventorySynced(count: number, options?: ExternalToast): void {
  toast.success(`Inventory synced`, {
    description: `${count} product${count !== 1 ? 's' : ''} updated`,
    ...options,
  });
}

// ============================================================================
// Sync Notifications
// ============================================================================

/**
 * Toast for module sync completion
 */
export function toastSyncComplete(module: string, options?: ExternalToast): void {
  toast.success(`${module} synced`, {
    description: `${module} data is now up to date`,
    ...options,
  });
}

/**
 * Toast for sync in progress
 */
export function toastSyncStarted(module: string, options?: ExternalToast): void {
  toast.info(`Syncing ${module}...`, {
    description: 'Please wait while data is being synchronized',
    ...options,
  });
}

/**
 * Toast for sync failure
 */
export function toastSyncFailed(module: string, options?: ExternalToast): void {
  toast.error(`${module} sync failed`, {
    description: 'Unable to sync data. Please try again.',
    ...options,
  });
}

// ============================================================================
// Product Notifications
// ============================================================================

/**
 * Toast for product creation
 */
export function toastProductCreated(productName: string, options?: ExternalToast): void {
  toast.success(`Product created`, {
    description: `${productName} has been added to your catalog`,
    ...options,
  });
}

/**
 * Toast for product update
 */
export function toastProductUpdated(productName: string, options?: ExternalToast): void {
  toast.success(`Product updated`, {
    description: `${productName} has been updated`,
    ...options,
  });
}

/**
 * Toast for product deletion
 */
export function toastProductDeleted(productName: string, options?: ExternalToast): void {
  toast.success(`Product deleted`, {
    description: `${productName} has been removed`,
    ...options,
  });
}

// ============================================================================
// Customer Notifications
// ============================================================================

/**
 * Toast for customer creation
 */
export function toastCustomerCreated(customerName: string, options?: ExternalToast): void {
  toast.success(`Customer created`, {
    description: `${customerName} has been added`,
    ...options,
  });
}

/**
 * Toast for customer update
 */
export function toastCustomerUpdated(customerName: string, options?: ExternalToast): void {
  toast.success(`Customer updated`, {
    description: `${customerName} profile has been updated`,
    ...options,
  });
}

// ============================================================================
// Payment Notifications
// ============================================================================

/**
 * Toast for successful payment
 */
export function toastPaymentReceived(amount: string, options?: ExternalToast): void {
  toast.success(`Payment received`, {
    description: `${amount} has been processed successfully`,
    ...options,
  });
}

/**
 * Toast for failed payment
 */
export function toastPaymentFailed(reason?: string, options?: ExternalToast): void {
  toast.error(`Payment failed`, {
    description: reason || 'Unable to process payment',
    ...options,
  });
}

/**
 * Toast for refund processed
 */
export function toastRefundProcessed(amount: string, options?: ExternalToast): void {
  toast.success(`Refund processed`, {
    description: `${amount} has been refunded`,
    ...options,
  });
}

// ============================================================================
// General Action Notifications
// ============================================================================

/**
 * Toast for successful save
 */
export function toastSaved(itemType?: string, options?: ExternalToast): void {
  const message = itemType ? `${itemType} saved` : 'Changes saved';
  toast.success(message, {
    description: 'Your changes have been saved successfully',
    ...options,
  });
}

/**
 * Toast for successful delete
 */
export function toastDeleted(itemType?: string, options?: ExternalToast): void {
  const message = itemType ? `${itemType} deleted` : 'Item deleted';
  toast.success(message, {
    description: 'The item has been permanently removed',
    ...options,
  });
}

/**
 * Toast for successful copy to clipboard
 */
export function toastCopied(itemType?: string, options?: ExternalToast): void {
  toast.success('Copied to clipboard', {
    description: itemType ? `${itemType} copied` : undefined,
    ...options,
  });
}

/**
 * Toast for successful export
 */
export function toastExported(format: string, options?: ExternalToast): void {
  toast.success(`Export complete`, {
    description: `Data exported as ${format}`,
    ...options,
  });
}

/**
 * Toast for successful import
 */
export function toastImported(count: number, itemType: string, options?: ExternalToast): void {
  toast.success(`Import complete`, {
    description: `${count} ${itemType}${count !== 1 ? 's' : ''} imported successfully`,
    ...options,
  });
}

// ============================================================================
// Error Notifications
// ============================================================================

/**
 * Toast for general errors with action context
 */
export function toastError(action: string, error?: Error | unknown, options?: ExternalToast): void {
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  toast.error(`Failed to ${action}`, {
    description: errorMessage,
    ...options,
  });
}

/**
 * Toast for validation errors
 */
export function toastValidationError(message: string, options?: ExternalToast): void {
  toast.error('Validation error', {
    description: message,
    ...options,
  });
}

/**
 * Toast for network errors
 */
export function toastNetworkError(options?: ExternalToast): void {
  toast.error('Network error', {
    description: 'Please check your connection and try again',
    ...options,
  });
}

/**
 * Toast for permission denied
 */
export function toastPermissionDenied(action?: string, options?: ExternalToast): void {
  toast.error('Permission denied', {
    description: action ? `You do not have permission to ${action}` : 'You do not have permission to perform this action',
    ...options,
  });
}

/**
 * Toast for session expired
 */
export function toastSessionExpired(options?: ExternalToast): void {
  toast.error('Session expired', {
    description: 'Please log in again to continue',
    ...options,
  });
}

// ============================================================================
// Info/Warning Notifications
// ============================================================================

/**
 * Toast for info messages
 */
export function toastInfo(title: string, description?: string, options?: ExternalToast): void {
  toast.info(title, {
    description,
    ...options,
  });
}

/**
 * Toast for warning messages
 */
export function toastWarning(title: string, description?: string, options?: ExternalToast): void {
  toast.warning(title, {
    description,
    ...options,
  });
}

// ============================================================================
// Loading/Progress Notifications
// ============================================================================

/**
 * Toast for loading state - returns a toast ID that can be used to dismiss
 */
export function toastLoading(message: string, options?: ExternalToast): string | number {
  return toast.loading(message, options);
}

/**
 * Dismiss a specific toast by ID
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Promise-based toast that shows loading, success, or error states
 * Returns the toast ID with an unwrap method to get the promise result
 */
export function toastPromise<T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: {
    loading?: string;
    success?: string | ((data: T) => string);
    error?: string | ((error: Error) => string);
  }
): { unwrap: () => Promise<T> } {
  return toast.promise(promise, messages);
}

// Re-export the base toast for advanced usage
export { toast };
