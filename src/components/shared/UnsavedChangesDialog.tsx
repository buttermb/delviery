/**
 * UnsavedChangesDialog Component
 * Confirmation dialog for unsaved changes when navigating away
 *
 * Pairs with useUnsavedChangesWarning hook for complete protection
 */

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
import { AlertTriangle } from 'lucide-react';

interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when user cancels (stays on page) */
  onCancel: () => void;
  /** Called when user confirms (leaves page) */
  onConfirm: () => void;
  /** Custom title (default: "Unsaved Changes") */
  title?: string;
  /** Custom message */
  message?: string;
  /** Label for cancel button (default: "Keep Editing") */
  cancelLabel?: string;
  /** Label for confirm button (default: "Discard Changes") */
  confirmLabel?: string;
}

/**
 * UnsavedChangesDialog - Confirmation dialog for discarding unsaved changes
 *
 * @example
 * ```tsx
 * const { showConfirmDialog, cancelNavigation, confirmNavigation, message } =
 *   useUnsavedChangesWarning({ isDirty });
 *
 * <UnsavedChangesDialog
 *   open={showConfirmDialog}
 *   onCancel={cancelNavigation}
 *   onConfirm={confirmNavigation}
 *   message={message}
 * />
 * ```
 */
export function UnsavedChangesDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Unsaved Changes',
  message = 'You have unsaved changes. Are you sure you want to leave?',
  cancelLabel = 'Keep Editing',
  confirmLabel = 'Discard Changes',
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
