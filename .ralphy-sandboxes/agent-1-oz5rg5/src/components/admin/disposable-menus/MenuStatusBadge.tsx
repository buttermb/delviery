import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';

interface MenuStatusBadgeProps {
  status: 'active' | 'soft_burned' | 'hard_burned' | 'expired';
  size?: 'sm' | 'default' | 'lg';
}

export const MenuStatusBadge = ({ status, size = 'default' }: MenuStatusBadgeProps) => {
  const configs = {
    active: {
      label: 'Active',
      icon: CheckCircle2,
    },
    soft_burned: {
      label: 'Soft Burned',
      icon: AlertTriangle,
    },
    hard_burned: {
      label: 'Hard Burned',
      icon: XCircle,
    },
    expired: {
      label: 'Expired',
      icon: Clock,
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

  const config = configs[status];
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
      <Icon className={cn(iconSizes[size], 'mr-1')} />
      {config.label}
    </Badge>
  );
};
