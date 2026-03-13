/**
 * MenuStockStatusBadge Component
 * Task 283: Add menu item stock status badges
 *
 * Shows stock availability status with color-coded badges
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'coming_soon';

interface StockStatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  className: string;
  description: string;
}

const STOCK_STATUS_CONFIG: Record<StockStatus, StockStatusConfig> = {
  in_stock: {
    label: 'In Stock',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'bg-emerald-500 text-white border-emerald-600',
    description: 'Available for immediate purchase',
  },
  low_stock: {
    label: 'Low Stock',
    variant: 'secondary',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'bg-amber-500 text-white border-amber-600',
    description: 'Limited quantity remaining',
  },
  out_of_stock: {
    label: 'Out of Stock',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    className: 'bg-red-500 text-white border-red-600',
    description: 'Currently unavailable',
  },
  coming_soon: {
    label: 'Coming Soon',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-blue-500 text-blue-600',
    description: 'Available soon',
  },
};

interface MenuStockStatusBadgeProps {
  status: StockStatus;
  quantity?: number;
  showQuantity?: boolean;
  showTooltip?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MenuStockStatusBadge({
  status,
  quantity,
  showQuantity = false,
  showTooltip = true,
  className,
  size = 'md',
}: MenuStockStatusBadgeProps) {
  const config = STOCK_STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0 h-5',
    md: 'text-xs px-2 py-0.5 h-6',
    lg: 'text-sm px-2.5 py-1 h-7',
  };

  const iconSizeClasses = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  const badgeContent = (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1.5 font-medium transition-all',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      <span className={iconSizeClasses[size]}>{config.icon}</span>
      <span>{config.label}</span>
      {showQuantity && quantity !== undefined && (
        <span className="ml-0.5 opacity-90">({quantity})</span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.description}</p>
          {showQuantity && quantity !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Quantity: {quantity}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Utility function to determine stock status based on quantity and thresholds
 */
export function getStockStatus(
  quantity: number,
  lowStockThreshold: number = 10
): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
