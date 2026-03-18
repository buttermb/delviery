import { useCallback } from 'react';
import { Loader2 } from 'lucide-react';

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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConfirmDialogVariant = 'default' | 'destructive';

interface ConfirmDialogProps {
  /** Controls whether the dialog is open */
  open: boolean;
  /** Callback fired when dialog open state changes (closing) */
  onOpenChange: (open: boolean) => void;
  /** Callback fired when confirm button is clicked */
  onConfirm: () => void;
  /** Title text displayed in the dialog header */
  title: string;
  /** Description text displayed in the dialog body */
  description: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Variant determining the confirm button style */
  variant?: ConfirmDialogVariant;
  /** Whether the confirm action is in progress (shows loading state) */
  loading?: boolean;
  /** Additional className for the dialog content */
  className?: string;
}

/**
 * ConfirmDialog — reusable confirmation modal built on shadcn AlertDialog.
 *
 * Supports default and destructive variants, loading state, and
 * customizable labels. Use for delete confirmations, status changes,
 * bulk operations, and any action requiring user confirmation.
 *
 * For delete-specific operations, prefer `ConfirmDeleteDialog` which
 * includes a warning icon and haptic feedback.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  className,
}: ConfirmDialogProps) {
  const handleConfirm = useCallback(() => {
    if (!loading) {
      onConfirm();
    }
  }, [loading, onConfirm]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn(className)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              variant === 'destructive' &&
                buttonVariants({ variant: 'destructive' })
            )}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Processing...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { ConfirmDialogProps };
