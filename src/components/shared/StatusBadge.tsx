/**
 * Status Badge Component
 * Consistent status indicators across the app
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusVariant = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'default';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

const statusConfig: Record<string, { variant: StatusVariant; label: string }> = {
  // Order statuses
  'pending': { variant: 'warning', label: 'Pending' },
  'assigned': { variant: 'info', label: 'Assigned' },
  'in_transit': { variant: 'info', label: 'In Transit' },
  'delivered': { variant: 'success', label: 'Delivered' },
  'completed': { variant: 'success', label: 'Completed' },
  'cancelled': { variant: 'error', label: 'Cancelled' },
  'processing': { variant: 'info', label: 'Processing' },
  'picked_up': { variant: 'info', label: 'Picked Up' },
  'failed': { variant: 'error', label: 'Failed' },
  
  // Payment statuses
  'paid': { variant: 'success', label: 'Paid' },
  'unpaid': { variant: 'warning', label: 'Unpaid' },
  'partial': { variant: 'warning', label: 'Partial' },
  'overdue': { variant: 'error', label: 'Overdue' },
  
  // Inventory statuses
  'in_stock': { variant: 'success', label: 'In Stock' },
  'low_stock': { variant: 'warning', label: 'Low Stock' },
  'out_of_stock': { variant: 'error', label: 'Out of Stock' },
  'reserved': { variant: 'info', label: 'Reserved' },
  
  // Client/Menu statuses
  'active': { variant: 'success', label: 'Active' },
  'suspended': { variant: 'warning', label: 'Suspended' },
  'inactive': { variant: 'default', label: 'Inactive' },
  'burned': { variant: 'error', label: 'Burned' },
  'soft_burned': { variant: 'warning', label: 'Soft Burned' },
  'hard_burned': { variant: 'error', label: 'Hard Burned' },
  'expired': { variant: 'warning', label: 'Expired' },
  
  // Courier statuses
  'available': { variant: 'success', label: 'Available' },
  'on_delivery': { variant: 'info', label: 'On Delivery' },
  'offline': { variant: 'default', label: 'Offline' },
  
  // Transfer statuses
  'scheduled': { variant: 'info', label: 'Scheduled' },
  'transfer_completed': { variant: 'success', label: 'Transfer Completed' },
};

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  default: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ 
  status, 
  variant, 
  className 
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || { 
    variant: variant || 'default', 
    label: status 
  };
  const finalVariant = variant || config.variant;
  const label = config.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        variantStyles[finalVariant],
        'font-medium',
        className
      )}
    >
      {label}
    </Badge>
  );
}

