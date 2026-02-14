import React, { useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface SafeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDirty: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Custom message for unsaved changes dialog */
  unsavedMessage?: string;
  /** Show unsaved indicator in header */
  showUnsavedIndicator?: boolean;
}

/**
 * SafeModal - A modal wrapper that prevents accidental data loss
 * 
 * Features:
 * - Tracks dirty state and warns before closing
 * - Shows unsaved indicator in header
 * - Prevents outside click closure when dirty
 * - Keyboard escape requires confirmation when dirty
 */
export function SafeModal({
  open,
  onOpenChange,
  isDirty,
  title,
  description,
  children,
  className,
  unsavedMessage = 'You have unsaved changes. Are you sure you want to close?',
  showUnsavedIndicator = true,
}: SafeModalProps) {
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isDirty) {
      // Trying to close with unsaved changes
      setShowConfirmDialog(true);
      return;
    }
    onOpenChange(newOpen);
  }, [isDirty, onOpenChange]);

  const handleConfirmClose = useCallback(() => {
    setShowConfirmDialog(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDirty) {
        e.preventDefault();
        e.stopPropagation();
        setShowConfirmDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, isDirty]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className={cn("sm:max-w-lg", className)}
          onPointerDownOutside={(e) => {
            if (isDirty) {
              e.preventDefault();
              setShowConfirmDialog(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isDirty) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {title}
              {showUnsavedIndicator && isDirty && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved
                </span>
              )}
            </DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {unsavedMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Hook to track form dirty state
 */
export function useFormDirtyState<T extends Record<string, any>>(
  initialValues: T,
  currentValues: T
): boolean {
  return React.useMemo(() => {
    return JSON.stringify(initialValues) !== JSON.stringify(currentValues);
  }, [initialValues, currentValues]);
}

export default SafeModal;
