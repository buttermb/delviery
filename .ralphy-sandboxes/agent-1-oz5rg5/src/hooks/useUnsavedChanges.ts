import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

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
 * Uses React Router's useBlocker for in-app navigation
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
  // Block in-app navigation via React Router
  const blocker = useBlocker(isDirty);

  // Block browser close/refresh
  useEffect(() => {
    if (!blockBrowserClose || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, blockBrowserClose]);

  const confirmLeave = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return {
    showBlockerDialog: blocker.state === 'blocked',
    confirmLeave,
    cancelLeave,
  };
}
