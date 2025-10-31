import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';

interface MenuStatusBadgeProps {
  status: 'active' | 'soft_burned' | 'hard_burned' | 'expired';
  size?: 'sm' | 'default' | 'lg';
}

export const MenuStatusBadge = ({ status, size = 'default' }: MenuStatusBadgeProps) => {
  const configs = {
    active: {
      label: 'Active',
      icon: CheckCircle2,
      className: 'bg-green-500 hover:bg-green-600'
    },
    soft_burned: {
      label: 'Soft Burned',
      icon: AlertTriangle,
      className: 'bg-yellow-500 hover:bg-yellow-600'
    },
    hard_burned: {
      label: 'Hard Burned',
      icon: XCircle,
      className: 'bg-red-500 hover:bg-red-600'
    },
    expired: {
      label: 'Expired',
      icon: Clock,
      className: 'bg-gray-500 hover:bg-gray-600'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
