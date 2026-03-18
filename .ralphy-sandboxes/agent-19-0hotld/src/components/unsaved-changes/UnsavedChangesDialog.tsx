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

interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Title of the dialog */
  title?: string;
  /** Description/message shown in the dialog */
  description?: string;
  /** Text for the "Leave" button */
  leaveButtonText?: string;
  /** Text for the "Stay" button */
  stayButtonText?: string;
  /** Called when user confirms leaving (discards changes) */
  onConfirmLeave: () => void;
  /** Called when user cancels (stays on page) */
  onCancelLeave: () => void;
}

/**
 * Dialog component to confirm leaving a page with unsaved changes.
 *
 * Use this with the `useUnsavedChanges` hook for in-app navigation blocking.
 *
 * @example
 * ```tsx
 * const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
 *   isDirty: formState.isDirty
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
export function UnsavedChangesDialog({
  open,
  title = 'Unsaved Changes',
  description = 'You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?',
  leaveButtonText = 'Leave Page',
  stayButtonText = 'Stay on Page',
  onConfirmLeave,
  onCancelLeave,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancelLeave()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancelLeave}>
            {stayButtonText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmLeave}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {leaveButtonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
