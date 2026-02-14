/**
 * Order Priority Select Component
 *
 * Dropdown select for changing order priority with colored indicators.
 * Shows current priority and allows changing to any level.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUpdateOrderPriority } from '@/hooks/useOrderPriority';
import type { OrderPriority } from '@/components/admin/orders/OrderPriorityFlag';
import Zap from 'lucide-react/dist/esm/icons/zap';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Flag from 'lucide-react/dist/esm/icons/flag';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';

interface OrderPrioritySelectProps {
  orderId: string;
  currentPriority: OrderPriority;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

const priorityOptions: Array<{
  value: OrderPriority;
  label: string;
  icon: typeof Zap;
  colorClass: string;
}> = [
  {
    value: 'urgent',
    label: 'Urgent',
    icon: Zap,
    colorClass: 'text-red-600 dark:text-red-400',
  },
  {
    value: 'high',
    label: 'High',
    icon: AlertTriangle,
    colorClass: 'text-orange-600 dark:text-orange-400',
  },
  {
    value: 'normal',
    label: 'Normal',
    icon: Flag,
    colorClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'low',
    label: 'Low',
    icon: CheckCircle2,
    colorClass: 'text-green-600 dark:text-green-400',
  },
];

export function OrderPrioritySelect({
  orderId,
  currentPriority,
  className,
  disabled = false,
  size = 'default',
}: OrderPrioritySelectProps) {
  const updatePriority = useUpdateOrderPriority();

  const handlePriorityChange = (newPriority: OrderPriority) => {
    if (newPriority !== currentPriority) {
      updatePriority.mutate({ orderId, priority: newPriority });
    }
  };

  const currentOption = priorityOptions.find((opt) => opt.value === currentPriority) || priorityOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <Select
      value={currentPriority}
      onValueChange={handlePriorityChange}
      disabled={disabled || updatePriority.isPending}
    >
      <SelectTrigger
        className={cn(
          'font-medium',
          size === 'sm' && 'h-8 text-xs',
          className
        )}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <CurrentIcon className={cn('h-4 w-4', currentOption.colorClass)} />
            {currentOption.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {priorityOptions.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className="font-medium"
            >
              <span className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', option.colorClass)} />
                {option.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default OrderPrioritySelect;
