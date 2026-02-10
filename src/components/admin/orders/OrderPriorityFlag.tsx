/**
 * Order Priority Flag Component
 *
 * Displays a badge indicating the priority level of an order.
 * Supports urgent, high, normal, and low priority indicators with
 * appropriate colors and icons for quick visual identification.
 * Urgent orders show a pulsing animation to draw attention.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Flag from "lucide-react/dist/esm/icons/flag";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Zap from "lucide-react/dist/esm/icons/zap";

export type OrderPriority = 'urgent' | 'high' | 'normal' | 'low';

interface OrderPriorityFlagProps {
  priority: OrderPriority;
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const priorityConfig: Record<
  OrderPriority,
  {
    label: string;
    icon: typeof AlertTriangle;
    colorClasses: string;
    iconClasses?: string;
  }
> = {
  urgent: {
    label: 'URGENT',
    icon: Zap,
    colorClasses:
      'bg-red-600/20 text-red-600 border-red-600/30 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 font-bold',
    iconClasses: 'animate-pulse',
  },
  high: {
    label: 'High Priority',
    icon: AlertTriangle,
    colorClasses:
      'bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/30',
    iconClasses: 'animate-pulse',
  },
  normal: {
    label: 'Normal',
    icon: Flag,
    colorClasses:
      'bg-info/10 text-info border-info/20 dark:bg-info/20 dark:text-info dark:border-info/30',
  },
  low: {
    label: 'Low Priority',
    icon: CheckCircle2,
    colorClasses:
      'bg-success/10 text-success border-success/20 dark:bg-success/20 dark:text-success dark:border-success/30',
  },
};

const sizeConfig = {
  sm: {
    badge: 'px-1.5 py-0.5 text-[10px]',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  default: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3.5 w-3.5',
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'px-2.5 py-1 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-2',
  },
};

export function OrderPriorityFlag({
  priority,
  className,
  showIcon = true,
  showLabel = true,
  size = 'default',
}: OrderPriorityFlagProps) {
  const config = priorityConfig[priority];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-medium transition-colors duration-200 border',
        sizes.badge,
        sizes.gap,
        config.colorClasses,
        className
      )}
      title={config.label}
    >
      {showIcon && (
        <Icon className={cn(sizes.icon, config.iconClasses)} />
      )}
      {showLabel && config.label}
    </Badge>
  );
}
