import * as React from 'react';
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

/**
 * Dialog variant for styling the confirm button
 */
export type ConfirmDialogVariant = 'default' | 'destructive';

interface ConfirmDialogProps {
  /** Controls whether the dialog is open */
  isOpen: boolean;
  /** Callback fired when confirm button is clicked */
  onConfirm: () => void;
  /** Callback fired when cancel button is clicked or dialog is dismissed */
  onCancel: () => void;
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
 * ConfirmDialog - Reusable confirmation modal using shadcn/ui AlertDialog
 *
 * A standardized confirmation dialog for delete confirmations, status changes,
 * bulk operations, and other actions requiring user confirmation. Supports
 * default and destructive variants with the destructive variant showing a red button.
 *
 * Usage:
 * ```tsx
 * // Delete confirmation
 * <ConfirmDialog
 *   isOpen={showDeleteConfirm}
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDeleteConfirm(false)}
 *   title="Delete Product"
 *   description="Are you sure you want to delete this product? This action cannot be undone."
 *   confirmLabel="Delete"
 *   variant="destructive"
 * />
 *
 * // Status change confirmation
 * <ConfirmDialog
 *   isOpen={showStatusConfirm}
 *   onConfirm={handleStatusChange}
 *   onCancel={() => setShowStatusConfirm(false)}
 *   title="Change Status"
 *   description="Are you sure you want to mark this order as completed?"
 *   confirmLabel="Confirm"
 * />
 *
 * // Bulk operation confirmation
 * <ConfirmDialog
 *   isOpen={showBulkConfirm}
 *   onConfirm={handleBulkAction}
 *   onCancel={() => setShowBulkConfirm(false)}
 *   title="Delete Selected Items"
 *   description="Are you sure you want to delete 5 selected items? This action cannot be undone."
 *   confirmLabel="Delete All"
 *   variant="destructive"
 *   loading={isDeleting}
 * />
 * ```
 */
export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  className,
}: ConfirmDialogProps) {
  const handleConfirm = React.useCallback(() => {
    if (!loading) {
      onConfirm();
    }
  }, [loading, onConfirm]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className={cn(className)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>
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

export default ConfirmDialog;
