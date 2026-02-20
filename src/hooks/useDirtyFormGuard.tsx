import { useState, useCallback } from 'react';

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

/**
 * Hook to guard modal/dialog close when form has unsaved changes.
 *
 * Usage:
 * ```tsx
 * const { guardedOnOpenChange, dialogContentProps, DiscardAlert } =
 *   useDirtyFormGuard(isDirty, () => onOpenChange(false));
 *
 * <Dialog open={open} onOpenChange={guardedOnOpenChange}>
 *   <DialogContent {...dialogContentProps}>
 *     ...
 *   </DialogContent>
 * </Dialog>
 * <DiscardAlert />
 * ```
 */
export function useDirtyFormGuard(
  isDirty: boolean,
  onClose: () => void,
  message = 'You have unsaved changes. Are you sure you want to close?'
) {
  const [showConfirm, setShowConfirm] = useState(false);

  const guardedOnOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDirty) {
        setShowConfirm(true);
        return;
      }
      if (!open) {
        onClose();
      }
    },
    [isDirty, onClose]
  );

  const dialogContentProps = {
    onPointerDownOutside: (e: Event) => {
      if (isDirty) {
        e.preventDefault();
        setShowConfirm(true);
      }
    },
    onEscapeKeyDown: (e: Event) => {
      if (isDirty) {
        e.preventDefault();
        setShowConfirm(true);
      }
    },
  };

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  function DiscardAlert() {
    return (
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return {
    guardedOnOpenChange,
    dialogContentProps,
    DiscardAlert,
    showConfirm,
  };
}
