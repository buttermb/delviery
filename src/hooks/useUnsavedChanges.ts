import { useState, useEffect, useCallback, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { logger } from '@/lib/logger';

interface UseUnsavedChangesOptions {
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Custom message for the browser's beforeunload dialog (note: most browsers ignore custom messages) */
  message?: string;
  /** Whether to block in-app navigation (using React Router) */
  blockNavigation?: boolean;
  /** Callback when user confirms leaving with unsaved changes */
  onLeaveConfirmed?: () => void;
  /** Callback when user cancels leaving */
  onLeaveCancelled?: () => void;
}

interface UseUnsavedChangesReturn {
  /** Current dirty state */
  isDirty: boolean;
  /** Set dirty state directly */
  setIsDirty: (dirty: boolean) => void;
  /** Mark form as dirty */
  markDirty: () => void;
  /** Mark form as clean (e.g., after successful save) */
  markClean: () => void;
  /** Whether the navigation blocker dialog should be shown */
  showBlockerDialog: boolean;
  /** Confirm leaving (proceed with navigation) */
  confirmLeave: () => void;
  /** Cancel leaving (stay on page) */
  cancelLeave: () => void;
  /** Blocked navigation location (if any) */
  blockedLocation: string | null;
}

/**
 * Hook to warn users about unsaved changes before leaving a page.
 *
 * Features:
 * - Tracks dirty/clean state for forms
 * - Shows browser's native "Leave site?" dialog on beforeunload (tab close, refresh, external navigation)
 * - Blocks in-app navigation with React Router and shows a custom dialog
 *
 * @example
 * ```tsx
 * const { isDirty, setIsDirty, showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
 *   isDirty: form.formState.isDirty, // Can sync with React Hook Form's isDirty
 *   blockNavigation: true
 * });
 *
 * // Or manage dirty state manually:
 * const { markDirty, markClean, showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges();
 *
 * // In your form onChange:
 * onChange={() => markDirty()}
 *
 * // After successful save:
 * onSuccess: () => markClean()
 * ```
 */
export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}): UseUnsavedChangesReturn {
  const {
    isDirty: externalIsDirty,
    message = 'You have unsaved changes. Are you sure you want to leave?',
    blockNavigation = true,
    onLeaveConfirmed,
    onLeaveCancelled,
  } = options;

  // Internal dirty state (used when not syncing with external state)
  const [internalIsDirty, setInternalIsDirty] = useState(false);

  // Use external isDirty if provided, otherwise use internal state
  const isDirty = externalIsDirty ?? internalIsDirty;

  // Track whether we should show the custom navigation blocker dialog
  const [showBlockerDialog, setShowBlockerDialog] = useState(false);
  const [blockedLocation, setBlockedLocation] = useState<string | null>(null);

  // Ref to store the blocker's proceed function
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  // Block in-app navigation when dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      blockNavigation && isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle blocker state changes
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowBlockerDialog(true);
      setBlockedLocation(blocker.location.pathname);
      proceedRef.current = blocker.proceed;
      resetRef.current = blocker.reset;
      logger.info('Navigation blocked due to unsaved changes', {
        to: blocker.location.pathname
      });
    }
  }, [blocker.state, blocker.location, blocker.proceed, blocker.reset]);

  // Handle beforeunload event for browser navigation (tab close, refresh, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Modern browsers require returnValue to be set
        e.preventDefault();
        // Legacy support (most browsers ignore custom messages now)
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  const setIsDirty = useCallback((dirty: boolean) => {
    setInternalIsDirty(dirty);
  }, []);

  const markDirty = useCallback(() => {
    setInternalIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setInternalIsDirty(false);
  }, []);

  const confirmLeave = useCallback(() => {
    setShowBlockerDialog(false);
    setBlockedLocation(null);
    setInternalIsDirty(false);

    if (proceedRef.current) {
      proceedRef.current();
      proceedRef.current = null;
      resetRef.current = null;
    }

    onLeaveConfirmed?.();
    logger.info('User confirmed leaving with unsaved changes');
  }, [onLeaveConfirmed]);

  const cancelLeave = useCallback(() => {
    setShowBlockerDialog(false);
    setBlockedLocation(null);

    if (resetRef.current) {
      resetRef.current();
      resetRef.current = null;
      proceedRef.current = null;
    }

    onLeaveCancelled?.();
    logger.info('User cancelled leaving with unsaved changes');
  }, [onLeaveCancelled]);

  return {
    isDirty,
    setIsDirty,
    markDirty,
    markClean,
    showBlockerDialog,
    confirmLeave,
    cancelLeave,
    blockedLocation,
  };
}

/**
 * Type for integrating with React Hook Form
 */
export type ReactHookFormDirtyState = {
  formState: {
    isDirty: boolean;
  };
};

/**
 * Utility to extract isDirty from React Hook Form
 */
export function getFormDirtyState(form: ReactHookFormDirtyState): boolean {
  return form.formState.isDirty;
}
