/**
 * OrderRushButton - Button to expedite orders to the front of the queue
 *
 * Features:
 * - Toggle rush status with single click
 * - Visual indicator when order is rushed
 * - Loading state during mutation
 * - Tooltip for icon-only variant
 * - Confirmation dialog for bulk operations
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrderRush } from '@/hooks/useOrderRush';

interface OrderRushButtonProps {
  orderId: string;
  orderNumber?: string | null;
  isRush?: boolean;
  variant?: 'default' | 'ghost' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  showConfirmation?: boolean;
  className?: string;
  disabled?: boolean;
}

export function OrderRushButton({
  orderId,
  orderNumber,
  isRush = false,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  showConfirmation = false,
  className,
  disabled = false,
}: OrderRushButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toggleRush, isPending } = useOrderRush();

  const handleClick = () => {
    if (showConfirmation && !isRush) {
      setShowConfirmDialog(true);
    } else {
      toggleRush({ orderId, isRush: !isRush, orderNumber });
    }
  };

  const handleConfirm = () => {
    toggleRush({ orderId, isRush: true, orderNumber });
    setShowConfirmDialog(false);
  };

  const buttonContent = (
    <>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Zap
          className={cn(
            'h-4 w-4',
            isRush && 'fill-yellow-500 text-yellow-500'
          )}
        />
      )}
      {showLabel && size !== 'icon' && (
        <span className="ml-1">
          {isPending
            ? 'Updating...'
            : isRush
            ? 'Rush Active'
            : 'Rush Order'}
        </span>
      )}
    </>
  );

  const button = (
    <Button
      variant={isRush ? 'default' : variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isPending}
      className={cn(
        isRush && 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950',
        className
      )}
    >
      {buttonContent}
    </Button>
  );

  return (
    <>
      {!showLabel || size === 'icon' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>
                {isRush
                  ? 'Remove from rush queue'
                  : 'Move to front of queue'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rush this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move{' '}
              {orderNumber ? `order #${orderNumber}` : 'this order'} to the
              front of the processing queue. Other orders may be delayed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
            >
              <Zap className="h-4 w-4 mr-1" />
              Rush Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * OrderRushBadge - Small indicator badge showing rush status
 */
interface OrderRushBadgeProps {
  isRush: boolean;
  className?: string;
}

export function OrderRushBadge({ isRush, className }: OrderRushBadgeProps) {
  if (!isRush) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
              className
            )}
          >
            <Zap className="h-3 w-3 fill-current" />
            Rush
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>This order is prioritized</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * OrderRushMenuItem - Context menu item variant for rush action
 */
interface OrderRushMenuItemProps {
  orderId: string;
  orderNumber?: string | null;
  isRush?: boolean;
  onAction?: () => void;
}

export function OrderRushMenuItem({
  orderId,
  orderNumber,
  isRush = false,
  onAction,
}: OrderRushMenuItemProps) {
  const { toggleRush, isPending } = useOrderRush();

  const handleClick = () => {
    toggleRush({ orderId, isRush: !isRush, orderNumber });
    onAction?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center',
        'rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        isRush && 'text-yellow-600 dark:text-yellow-400'
      )}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Zap
          className={cn(
            'mr-2 h-4 w-4',
            isRush && 'fill-yellow-500 text-yellow-500'
          )}
        />
      )}
      {isRush ? 'Remove Rush Status' : 'Rush Order'}
    </button>
  );
}
