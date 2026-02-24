/**
 * OrderRowContextMenu - Right-click Context Menu for Order Rows
 * Provides quick access to common order actions without navigating away
 */
import { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import {
  Eye,
  Edit,
  Copy,
  FileText,
  Send,
  Printer,
  Truck,
  Ban,
  RefreshCw,
  CheckCircle,
  Clock,
  Package,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrderContextAction =
  | 'view'
  | 'edit'
  | 'duplicate'
  | 'create_invoice'
  | 'send_update'
  | 'print_packing_slip'
  | 'cancel'
  | 'status_change';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';

interface OrderRowContextMenuProps {
  children: ReactNode;
  orderId: string;
  currentStatus?: OrderStatus | string;
  onAction: (action: OrderContextAction, data?: { status?: string }) => void;
  disabledActions?: OrderContextAction[];
  showStatusSubmenu?: boolean;
  showInvoiceAction?: boolean;
  showPrintAction?: boolean;
  className?: string;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string; icon: typeof Clock }[] = [
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'processing', label: 'Processing', icon: RefreshCw },
  { value: 'preparing', label: 'Preparing', icon: Package },
  { value: 'ready', label: 'Ready', icon: CheckCircle },
  { value: 'shipped', label: 'Shipped', icon: Truck },
  { value: 'in_transit', label: 'In Transit', icon: Truck },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle },
  { value: 'completed', label: 'Completed', icon: CheckCircle },
];

export function OrderRowContextMenu({
  children,
  orderId: _orderId,
  currentStatus,
  onAction,
  disabledActions = [],
  showStatusSubmenu = true,
  showInvoiceAction = true,
  showPrintAction = true,
  className,
}: OrderRowContextMenuProps) {
  const isDisabled = (action: OrderContextAction) => disabledActions.includes(action);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* View & Edit */}
        <ContextMenuItem
          onClick={() => onAction('view')}
          disabled={isDisabled('view')}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Details
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => onAction('edit')}
          disabled={isDisabled('edit')}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit Order
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Status Submenu */}
        {showStatusSubmenu && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <RefreshCw className="mr-2 h-4 w-4" />
                Change Status
                <ChevronRight className="ml-auto h-4 w-4" />
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {STATUS_OPTIONS.map((status) => {
                  const Icon = status.icon;
                  const isCurrent = status.value === currentStatus;
                  return (
                    <ContextMenuItem
                      key={status.value}
                      onClick={() => onAction('status_change', { status: status.value })}
                      disabled={isCurrent || isDisabled('status_change')}
                      className={cn(isCurrent && 'bg-accent')}
                    >
                      <Icon className={cn('mr-2 h-4 w-4', isCurrent && 'text-primary')} />
                      {status.label}
                      {isCurrent && (
                        <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </ContextMenuItem>
                  );
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        <ContextMenuSeparator />

        {/* Document Actions */}
        {showInvoiceAction && (
          <ContextMenuItem
            onClick={() => onAction('create_invoice')}
            disabled={isDisabled('create_invoice')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Create Invoice
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onClick={() => onAction('send_update')}
          disabled={isDisabled('send_update')}
        >
          <Send className="mr-2 h-4 w-4" />
          Send Update to Customer
        </ContextMenuItem>

        {showPrintAction && (
          <ContextMenuItem
            onClick={() => onAction('print_packing_slip')}
            disabled={isDisabled('print_packing_slip')}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Packing Slip
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Duplicate */}
        <ContextMenuItem
          onClick={() => onAction('duplicate')}
          disabled={isDisabled('duplicate')}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate Order
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Cancel */}
        <ContextMenuItem
          onClick={() => onAction('cancel')}
          disabled={isDisabled('cancel') || currentStatus === 'cancelled'}
          className="text-destructive focus-visible:text-destructive"
        >
          <Ban className="mr-2 h-4 w-4" />
          Cancel Order
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Hook to handle order context menu actions
 */
export function useOrderContextActions(options: {
  onView?: (orderId: string) => void;
  onEdit?: (orderId: string) => void;
  onDuplicate?: (orderId: string) => void;
  onCreateInvoice?: (orderId: string) => void;
  onSendUpdate?: (orderId: string) => void;
  onPrintPackingSlip?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
  onStatusChange?: (orderId: string, status: string) => Promise<void> | void;
}) {
  const handleAction = (
    orderId: string,
    action: OrderContextAction,
    data?: { status?: string }
  ) => {
    switch (action) {
      case 'view':
        options.onView?.(orderId);
        break;
      case 'edit':
        options.onEdit?.(orderId);
        break;
      case 'duplicate':
        options.onDuplicate?.(orderId);
        break;
      case 'create_invoice':
        options.onCreateInvoice?.(orderId);
        break;
      case 'send_update':
        options.onSendUpdate?.(orderId);
        break;
      case 'print_packing_slip':
        options.onPrintPackingSlip?.(orderId);
        break;
      case 'cancel':
        options.onCancel?.(orderId);
        break;
      case 'status_change':
        if (data?.status) {
          options.onStatusChange?.(orderId, data.status);
        }
        break;
    }
  };

  return { handleAction };
}
