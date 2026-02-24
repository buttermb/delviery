import { useEffect, useCallback, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface UseUnsavedChangesOptions {
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** Whether to also block browser close/refresh with beforeunload (default: true) */
  blockBrowserClose?: boolean;
}

interface UseUnsavedChangesReturn {
  /** Whether the blocker dialog should be shown */
  showBlockerDialog: boolean;
  /** Call to confirm leaving (discards changes) */
  confirmLeave: () => void;
  /** Call to cancel leaving (stays on page) */
  cancelLeave: () => void;
}

/**
 * Hook to warn users about unsaved changes when navigating away.
 * Uses popstate interception for back/forward navigation (BrowserRouter-compatible)
 * and beforeunload for browser close/refresh.
 *
 * @example
 * ```tsx
 * const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
 *   isDirty: formState.isDirty,
 * });
 *
 * return (
 *   <>
 *     <form>...</form>
 *     <UnsavedChangesDialog
 *       open={showBlockerDialog}
 *       onConfirmLeave={confirmLeave}
 *       onCancelLeave={cancelLeave}
 *     />
 *   </>
 * );
 * ```
 */
export function useUnsavedChanges({
  isDirty,
  blockBrowserClose = true,
}: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
  const location = useLocation();
  const [showBlockerDialog, setShowBlockerDialog] = useState(false);
  const allowNavigationRef = useRef(false);
  const currentUrlRef = useRef(
    window.location.pathname + window.location.search + window.location.hash
  );

  // Track current URL when not showing dialog
  useEffect(() => {
    if (!showBlockerDialog) {
      currentUrlRef.current =
        location.pathname + location.search + (location.hash ?? '');
    }
  }, [location, showBlockerDialog]);

  // Block browser close/refresh
  useEffect(() => {
    if (!blockBrowserClose || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, blockBrowserClose]);

  // Block back/forward browser navigation via popstate
  useEffect(() => {
    if (!isDirty) {
      allowNavigationRef.current = false;
      return;
    }

    const handlePopState = () => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      // Restore the current page URL in the address bar
      window.history.pushState(null, document.title, currentUrlRef.current);
      setShowBlockerDialog(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    setShowBlockerDialog(false);
    allowNavigationRef.current = true;
    window.history.back();
  }, []);

  const cancelLeave = useCallback(() => {
    setShowBlockerDialog(false);
  }, []);

  return {
    showBlockerDialog,
    confirmLeave,
    cancelLeave,
  };
}
