import { logger } from '@/lib/logger';
/**
 * Standardized Delete Confirmation Dialog
 * Use this component for all delete operations across the app
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
import { haptics } from '@/utils/haptics';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  itemType?: string; // e.g., "product", "order", "customer"
  isLoading?: boolean;
  destructive?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  itemType = 'item',
  isLoading = false,
  destructive = true,
}: ConfirmDeleteDialogProps) {
  const defaultTitle = title || `Delete ${itemType}`;
  const defaultDescription = description || 
    (itemName 
      ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
      : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`);

  const handleConfirm = async () => {
    try {
      haptics.heavy(); // Haptic feedback for destructive action
      await onConfirm();
      haptics.success(); // Success feedback after deletion
      // Parent controls dialog closing via setDeleteDialogOpen
    } catch (error) {
      haptics.error(); // Error feedback if deletion fails
      // Error is handled by parent, keep dialog open
      logger.error('Confirm action failed', error, { component: 'ConfirmDeleteDialog' });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>{defaultTitle}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

