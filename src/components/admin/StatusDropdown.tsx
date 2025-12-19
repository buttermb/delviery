/**
 * StatusDropdown - Inline Status Change Component
 * Reduces clicks from 3-4 to just 1 for status updates
 */
import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusVariant } from '@/lib/utils/statusColors';
import { toast } from 'sonner';

export type StatusOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

// Common status options for different entity types
export const ORDER_STATUSES: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const MENU_ORDER_STATUSES: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const WHOLESALE_ORDER_STATUSES: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PAYMENT_STATUSES: StatusOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'refunded', label: 'Refunded' },
];

interface StatusDropdownProps {
  currentStatus: string;
  statuses?: StatusOption[];
  onStatusChange: (newStatus: string) => Promise<void> | void;
  disabled?: boolean;
  size?: 'sm' | 'default';
  showCheckmark?: boolean;
  className?: string;
}

export function StatusDropdown({
  currentStatus,
  statuses = ORDER_STATUSES,
  onStatusChange,
  disabled = false,
  size = 'default',
  showCheckmark = true,
  className,
}: StatusDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  const currentStatusOption = statuses.find(s => s.value === currentStatus);
  const displayLabel = currentStatusOption?.label || currentStatus;

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled || isUpdating}
        className={cn(
          'inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Badge
          variant={getStatusVariant(currentStatus)}
          className={cn(
            'cursor-pointer transition-all hover:opacity-80',
            size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1',
            getStatusColor(currentStatus)
          )}
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          {displayLabel}
          {!isUpdating && (
            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
          )}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.value}
            onClick={() => handleStatusChange(status.value)}
            className={cn(
              'flex items-center justify-between cursor-pointer',
              status.value === currentStatus && 'bg-accent'
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  getStatusColor(status.value).split(' ')[0].replace('/10', '')
                )}
              />
              {status.label}
            </span>
            {showCheckmark && status.value === currentStatus && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
