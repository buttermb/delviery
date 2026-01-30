import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';

export type OrderPaymentStatusType = 'paid' | 'pending' | 'partial' | 'refunded';

interface OrderPaymentStatusBadgeProps {
  status: OrderPaymentStatusType | string;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

export const OrderPaymentStatusBadge = ({
  status,
  size = 'default',
  showIcon = true
}: OrderPaymentStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    const normalized = status.toLowerCase().replace(/\s+/g, '_');

    switch (normalized) {
      case 'paid':
        return { icon: CheckCircle, label: 'Paid' };
      case 'pending':
        return { icon: Clock, label: 'Pending' };
      case 'partial':
        return { icon: AlertCircle, label: 'Partial' };
      case 'refunded':
        return { icon: RotateCcw, label: 'Refunded' };
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

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium whitespace-nowrap border',
        sizeClasses[size],
        getStatusColor(status)
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], 'mr-1')} />}
      {config.label}
    </Badge>
  );
};
