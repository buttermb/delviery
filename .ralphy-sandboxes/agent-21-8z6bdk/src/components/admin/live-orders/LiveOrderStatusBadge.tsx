import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LiveOrderStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  },
  confirmed: {
    label: 'Confirmed',
    classes: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  },
  preparing: {
    label: 'Preparing',
    classes: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  },
  ready: {
    label: 'Ready',
    classes: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  },
  ready_for_pickup: {
    label: 'Ready',
    classes: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    classes: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
  },
  in_transit: {
    label: 'In Transit',
    classes: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
  },
  delivered: {
    label: 'Delivered',
    classes: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  },
};

const DEFAULT_CONFIG = {
  label: '',
  classes: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700',
};

export function LiveOrderStatusBadge({ status, className }: LiveOrderStatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  const config = STATUS_CONFIG[normalized] ?? DEFAULT_CONFIG;
  const label = config.label || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium px-1.5 py-0 h-5',
        config.classes,
        className
      )}
    >
      {label}
    </Badge>
  );
}
