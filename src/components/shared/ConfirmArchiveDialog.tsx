/**
 * ConfirmArchiveDialog - Confirmation dialog for archive/restore operations
 *
 * Use this component when you need user confirmation before archiving
 * or restoring an item. Supports both operations with appropriate messaging.
 */

import { logger } from '@/lib/logger';
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
import { Archive, ArchiveRestore } from 'lucide-react';
import { haptics } from '@/utils/haptics';

interface ConfirmArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  itemType?: string;
  isLoading?: boolean;
  /** Whether this is a restore operation (true) or archive operation (false) */
  isRestore?: boolean;
}

export function ConfirmArchiveDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  itemType = 'item',
  isLoading = false,
  isRestore = false,
}: ConfirmArchiveDialogProps) {
  const action = isRestore ? 'Restore' : 'Archive';
  const actionLower = isRestore ? 'restore' : 'archive';

  const defaultTitle = title || `${action} ${itemType}`;
  const defaultDescription =
    description ||
    (itemName
      ? isRestore
        ? `Are you sure you want to restore "${itemName}"? This will make it visible in your active inventory again.`
        : `Are you sure you want to archive "${itemName}"? It will be hidden from active inventory but can be restored later.`
      : isRestore
        ? `Are you sure you want to restore this ${itemType}? It will be visible again.`
        : `Are you sure you want to archive this ${itemType}? It can be restored later.`);

  const handleConfirm = async () => {
    try {
      haptics.medium();
      await onConfirm();
      haptics.success();
    } catch (error) {
      haptics.error();
      logger.error(`Confirm ${actionLower} action failed`, error, {
        component: 'ConfirmArchiveDialog',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            {isRestore ? (
              <ArchiveRestore className="h-5 w-5 text-primary" />
            ) : (
              <Archive className="h-5 w-5 text-warning" />
            )}
            <AlertDialogTitle>{defaultTitle}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              isRestore
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-warning text-warning-foreground hover:bg-warning/90'
            }
          >
            {isLoading ? `${action.slice(0, -1)}ing...` : action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
