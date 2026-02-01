import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Package, CheckCircle, XCircle, Truck, Loader2 } from 'lucide-react';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

const OrderStatusBadgeComponent = ({ status, size = 'default', showIcon = true }: OrderStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    const normalized = status.toLowerCase().replace(/\s+/g, '_');
    
    switch (normalized) {
      case 'pending':
        return { icon: Clock, label: 'Pending' };
      case 'processing':
      case 'preparing':
        return { icon: Loader2, label: 'Processing' };
      case 'ready':
      case 'ready_for_pickup':
        return { icon: Package, label: 'Ready' };
      case 'in_transit':
      case 'shipped':
        return { icon: Truck, label: 'In Transit' };
      case 'completed':
      case 'delivered':
        return { icon: CheckCircle, label: 'Completed' };
      case 'cancelled':
      case 'canceled':
        return { icon: XCircle, label: 'Cancelled' };
      default:
        return { icon: Clock, label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;
  const isSpinning = status.toLowerCase() === 'processing' || status.toLowerCase() === 'preparing';

  return (
    <Badge 
      variant="outline"
      className={cn(
        'gap-1 font-medium whitespace-nowrap border',
        sizeClasses[size],
        getStatusColor(status)
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], 'mr-1', isSpinning && 'animate-spin')} />}
      {config.label}
    </Badge>
  );
};

export const OrderStatusBadge = React.memo(OrderStatusBadgeComponent);
