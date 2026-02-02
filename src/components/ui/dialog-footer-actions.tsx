import React from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';

interface DialogFooterActionsProps {
  /** Primary action (rightmost, most prominent) */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  
  /** Secondary action (left of primary) */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  
  /** Destructive action (leftmost, red) */
  destructiveLabel?: string;
  onDestructive?: () => void;
  destructiveDisabled?: boolean;
  destructiveLoading?: boolean;
  
  /** Additional class name */
  className?: string;
  
  /** Align buttons */
  align?: 'left' | 'right' | 'spread';
}

/**
 * DialogFooterActions - Standardized button order for dialogs
 * 
 * Button order (left to right):
 * 1. Destructive action (least common, red)
 * 2. Secondary action (cancel, close)
 * 3. Primary action (most common, prominent)
 * 
 * This order follows common UI patterns where:
 * - Primary action is rightmost (natural flow)
 * - Destructive action is separated from primary
 * - Cancel is easily accessible but not prominent
 */
export function DialogFooterActions({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  
  secondaryLabel,
  onSecondary,
  secondaryDisabled = false,
  
  destructiveLabel,
  onDestructive,
  destructiveDisabled = false,
  destructiveLoading = false,
  
  className,
  align = 'right',
}: DialogFooterActionsProps) {
  const hasDestructive = destructiveLabel && onDestructive;
  const hasSecondary = secondaryLabel && onSecondary;
  const hasPrimary = primaryLabel && onPrimary;
  
  return (
    <DialogFooter
      className={cn(
        'gap-2',
        align === 'left' && 'justify-start',
        align === 'spread' && 'justify-between',
        className
      )}
    >
      {/* Destructive action - leftmost */}
      {hasDestructive && (
        <Button
          type="button"
          variant="destructive"
          onClick={onDestructive}
          disabled={destructiveDisabled || destructiveLoading}
          className={cn(align === 'spread' ? '' : 'mr-auto')}
        >
          {destructiveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {destructiveLabel}
        </Button>
      )}
      
      {/* Spacer for spread alignment */}
      {align === 'spread' && !hasDestructive && <div />}
      
      <div className="flex gap-2">
        {/* Secondary action - left of primary */}
        {hasSecondary && (
          <Button
            type="button"
            variant="outline"
            onClick={onSecondary}
            disabled={secondaryDisabled}
          >
            {secondaryLabel}
          </Button>
        )}
        
        {/* Primary action - rightmost */}
        {hasPrimary && (
          <Button
            type="submit"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {primaryLabel}
          </Button>
        )}
      </div>
    </DialogFooter>
  );
}

/**
 * Preset configurations for common dialog patterns
 */
export const DialogFooterPresets = {
  /** Save/Cancel pattern */
  saveCancel: (
    onSave: () => void,
    onCancel: () => void,
    saving = false,
    isDirty = true
  ) => ({
    primaryLabel: saving ? 'Saving...' : 'Save',
    onPrimary: onSave,
    primaryLoading: saving,
    primaryDisabled: !isDirty || saving,
    secondaryLabel: 'Cancel',
    onSecondary: onCancel,
  }),
  
  /** Confirm/Cancel pattern */
  confirmCancel: (
    onConfirm: () => void,
    onCancel: () => void,
    confirming = false,
    confirmLabel = 'Confirm'
  ) => ({
    primaryLabel: confirmLabel,
    onPrimary: onConfirm,
    primaryLoading: confirming,
    secondaryLabel: 'Cancel',
    onSecondary: onCancel,
  }),
  
  /** Delete confirmation pattern */
  deleteConfirm: (
    onDelete: () => void,
    onCancel: () => void,
    deleting = false
  ) => ({
    destructiveLabel: deleting ? 'Deleting...' : 'Delete',
    onDestructive: onDelete,
    destructiveLoading: deleting,
    secondaryLabel: 'Cancel',
    onSecondary: onCancel,
  }),
  
  /** Edit with delete pattern */
  editWithDelete: (
    onSave: () => void,
    onCancel: () => void,
    onDelete: () => void,
    saving = false,
    isDirty = true
  ) => ({
    primaryLabel: saving ? 'Saving...' : 'Save',
    onPrimary: onSave,
    primaryLoading: saving,
    primaryDisabled: !isDirty || saving,
    secondaryLabel: 'Cancel',
    onSecondary: onCancel,
    destructiveLabel: 'Delete',
    onDestructive: onDelete,
  }),
};

export default DialogFooterActions;
