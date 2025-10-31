import { Badge } from '@/components/ui/badge';
import { Clock, Package, CheckCircle, XCircle } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          label: 'Pending',
          className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
        };
      case 'processing':
        return {
          variant: 'default' as const,
          icon: Package,
          label: 'Processing',
          className: 'bg-blue-500/10 text-blue-700 border-blue-500/20'
        };
      case 'completed':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          label: 'Completed',
          className: 'bg-green-500/10 text-green-700 border-green-500/20'
        };
      case 'cancelled':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          label: 'Cancelled',
          className: 'bg-red-500/10 text-red-700 border-red-500/20'
        };
      default:
        return {
          variant: 'outline' as const,
          icon: Clock,
          label: status,
          className: ''
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
