/**
 * useUnsavedChangesWarning Hook
 * Warns users before navigating away from pages with unsaved changes
 *
 * Handles:
 * - Browser back/forward navigation
 * - Tab/window close
 * - In-app navigation via the provided callback
 */

import { useEffect, useCallback, useState, useRef } from 'react';

interface UseUnsavedChangesWarningOptions {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Warning message for the confirmation dialog */
  message?: string;
  /** Callback when user confirms navigation (discards changes) */
  onConfirmNavigation?: () => void;
}

interface UseUnsavedChangesWarningReturn {
  /** Whether the confirmation dialog should be shown */
  showConfirmDialog: boolean;
  /** Close the confirmation dialog and stay on page */
  cancelNavigation: () => void;
  /** Confirm navigation and execute pending action */
  confirmNavigation: () => void;
  /** Safely navigate - shows dialog if dirty, otherwise navigates immediately */
  safeNavigate: (navigateFn: () => void) => void;
  /** The warning message */
  message: string;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Hook to warn users before navigating away from pages with unsaved changes
 *
 * @example
 * ```tsx
 * const [formData, setFormData] = useState(initialData);
 * const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);
 *
 * const {
 *   showConfirmDialog,
 *   cancelNavigation,
 *   confirmNavigation,
 *   safeNavigate,
 *   message
 * } = useUnsavedChangesWarning({ isDirty });
 *
 * // Use safeNavigate for back button
 * <BackButton onClick={() => safeNavigate(() => navigateToAdmin('orders'))} />
 *
 * // Render confirmation dialog
 * <UnsavedChangesDialog
 *   open={showConfirmDialog}
 *   onCancel={cancelNavigation}
 *   onConfirm={confirmNavigation}
 *   message={message}
 * />
 * ```
 */
export function useUnsavedChangesWarning({
  isDirty,
  message = DEFAULT_MESSAGE,
  onConfirmNavigation,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningReturn {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  // Handle browser beforeunload event
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but we still need to set returnValue
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  // Safe navigation function - checks for unsaved changes before navigating
  const safeNavigate = useCallback(
    (navigateFn: () => void) => {
      if (isDirty) {
        pendingNavigationRef.current = navigateFn;
        setShowConfirmDialog(true);
      } else {
        navigateFn();
      }
    },
    [isDirty]
  );

  // Cancel navigation - close dialog and stay on page
  const cancelNavigation = useCallback(() => {
    setShowConfirmDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  // Confirm navigation - execute pending navigation
  const confirmNavigation = useCallback(() => {
    setShowConfirmDialog(false);
    onConfirmNavigation?.();

    if (pendingNavigationRef.current) {
      pendingNavigationRef.current();
      pendingNavigationRef.current = null;
    }
  }, [onConfirmNavigation]);

  return {
    showConfirmDialog,
    cancelNavigation,
    confirmNavigation,
    safeNavigate,
    message,
  };
}

/**
 * Helper to compare form values for dirty detection
 */
export function isFormDirty<T extends Record<string, unknown>>(
  initialValues: T,
  currentValues: T
): boolean {
  return JSON.stringify(initialValues) !== JSON.stringify(currentValues);
}
