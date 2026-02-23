/**
 * OrderActionsDropdown - Dropdown menu for order-level actions
 * Provides quick access to edit, cancel, refund, and duplicate actions
 */
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Edit from "lucide-react/dist/esm/icons/edit";
import Copy from "lucide-react/dist/esm/icons/copy";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';

export type OrderAction = 'edit' | 'cancel' | 'refund' | 'duplicate';

interface OrderActionsDropdownProps {
  /** Unique identifier for the order */
  orderId: string;
  /** Current order status - affects which actions are available */
  orderStatus?: string;
  /** Callback fired when an action is selected */
  onAction: (action: OrderAction, orderId: string) => void | Promise<void>;
  /** Actions to disable (e.g., based on permissions or order state) */
  disabledActions?: OrderAction[];
  /** Whether an action is currently being performed */
  isLoading?: boolean;
  /** Which action is currently loading (for showing spinner on specific item) */
  loadingAction?: OrderAction;
  /** Custom trigger element - defaults to MoreHorizontal icon button */
  trigger?: React.ReactNode;
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Alignment of the dropdown content */
  align?: 'start' | 'center' | 'end';
  /** Size variant */
  size?: 'sm' | 'default';
}

interface ActionConfig {
  action: OrderAction;
  label: string;
  icon: typeof Edit;
  destructive?: boolean;
  /** Status values where this action should be hidden */
  hideOnStatus?: string[];
  /** Status values where this action should be disabled */
  disableOnStatus?: string[];
}

const ACTION_CONFIGS: ActionConfig[] = [
  {
    action: 'edit',
    label: 'Edit Order',
    icon: Edit,
    // Can't edit completed or cancelled orders
    disableOnStatus: ['completed', 'cancelled', 'refunded'],
  },
  {
    action: 'duplicate',
    label: 'Duplicate Order',
    icon: Copy,
    // Can always duplicate
  },
  {
    action: 'refund',
    label: 'Refund Order',
    icon: RotateCcw,
    destructive: true,
    // Can't refund already refunded, cancelled, or pending orders
    hideOnStatus: ['refunded'],
    disableOnStatus: ['pending', 'cancelled'],
  },
  {
    action: 'cancel',
    label: 'Cancel Order',
    icon: XCircle,
    destructive: true,
    // Can't cancel already cancelled, completed, or refunded orders
    hideOnStatus: ['cancelled'],
    disableOnStatus: ['completed', 'refunded', 'delivered'],
  },
];

export function OrderActionsDropdown({
  orderId,
  orderStatus = 'pending',
  onAction,
  disabledActions = [],
  isLoading = false,
  loadingAction,
  trigger,
  triggerClassName,
  align = 'end',
  size = 'default',
}: OrderActionsDropdownProps) {
  const [open, setOpen] = useState(false);

  const handleAction = async (action: OrderAction) => {
    await onAction(action, orderId);
    setOpen(false);
  };

  const isActionDisabled = (config: ActionConfig): boolean => {
    // Check if explicitly disabled via props
    if (disabledActions.includes(config.action)) return true;

    // Check if disabled based on current order status
    if (config.disableOnStatus?.includes(orderStatus)) return true;

    // Disabled if any action is currently loading
    if (isLoading) return true;

    return false;
  };

  const isActionHidden = (config: ActionConfig): boolean => {
    // Check if should be hidden based on current order status
    if (config.hideOnStatus?.includes(orderStatus)) return true;

    return false;
  };

  const visibleActions = ACTION_CONFIGS.filter((config) => !isActionHidden(config));
  const regularActions = visibleActions.filter((config) => !config.destructive);
  const destructiveActions = visibleActions.filter((config) => config.destructive);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-11 w-11' : 'h-11 w-11';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            variant="ghost"
            className={cn(buttonSize, 'p-0', triggerClassName)}
            onClick={(e) => e.stopPropagation()}
            disabled={isLoading && !loadingAction}
          >
            {isLoading && !loadingAction ? (
              <Loader2 className={cn(iconSize, 'animate-spin')} />
            ) : (
              <MoreHorizontal className={iconSize} />
            )}
            <span className="sr-only">Open order actions menu</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Regular actions */}
        {regularActions.map((config) => {
          const Icon = config.icon;
          const isCurrentLoading = loadingAction === config.action;
          const disabled = isActionDisabled(config);

          return (
            <DropdownMenuItem
              key={config.action}
              onClick={() => handleAction(config.action)}
              disabled={disabled}
              className="cursor-pointer"
            >
              {isCurrentLoading ? (
                <Loader2 className={cn('mr-2', iconSize, 'animate-spin')} />
              ) : (
                <Icon className={cn('mr-2', iconSize)} />
              )}
              {config.label}
            </DropdownMenuItem>
          );
        })}

        {/* Separator before destructive actions */}
        {regularActions.length > 0 && destructiveActions.length > 0 && (
          <DropdownMenuSeparator />
        )}

        {/* Destructive actions */}
        {destructiveActions.map((config) => {
          const Icon = config.icon;
          const isCurrentLoading = loadingAction === config.action;
          const disabled = isActionDisabled(config);

          return (
            <DropdownMenuItem
              key={config.action}
              onClick={() => handleAction(config.action)}
              disabled={disabled}
              className={cn(
                'cursor-pointer',
                'text-destructive focus:text-destructive focus:bg-destructive/10'
              )}
            >
              {isCurrentLoading ? (
                <Loader2 className={cn('mr-2', iconSize, 'animate-spin')} />
              ) : (
                <Icon className={cn('mr-2', iconSize)} />
              )}
              {config.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook to handle order actions with common patterns
 * Use this in combination with OrderActionsDropdown for type-safe action handling
 */
export function useOrderActions(options: {
  onEdit?: (orderId: string) => void | Promise<void>;
  onCancel?: (orderId: string) => void | Promise<void>;
  onRefund?: (orderId: string) => void | Promise<void>;
  onDuplicate?: (orderId: string) => void | Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState<OrderAction | undefined>();
  const [loadingOrderId, setLoadingOrderId] = useState<string | undefined>();

  const handleAction = async (action: OrderAction, orderId: string) => {
    const handler = {
      edit: options.onEdit,
      cancel: options.onCancel,
      refund: options.onRefund,
      duplicate: options.onDuplicate,
    }[action];

    if (!handler) return;

    setLoadingAction(action);
    setLoadingOrderId(orderId);

    try {
      await handler(orderId);
    } finally {
      setLoadingAction(undefined);
      setLoadingOrderId(undefined);
    }
  };

  return {
    handleAction,
    loadingAction,
    loadingOrderId,
    isLoading: !!loadingAction,
  };
}
