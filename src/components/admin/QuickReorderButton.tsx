/**
 * QuickReorderButton - One-click to repeat a previous order
 * Reduces friction: "Reorder" button pre-fills everything from past order
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  customer_id: string;
  customer_name?: string;
  items: OrderItem[];
  total: number;
}

interface QuickReorderButtonProps {
  order: Order;
  onReorder: (order: Order) => Promise<void>;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function QuickReorderButton({
  order,
  onReorder,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  className,
}: QuickReorderButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReorder = async () => {
    setIsLoading(true);
    try {
      await onReorder(order);
      setIsSuccess(true);
      toast.success('Order duplicated! Review and submit when ready.');
      
      // Reset success state after animation
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      toast.error('Failed to create reorder. Please try again.', { description: humanizeError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleReorder}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSuccess ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isLoading ? 'Creating...' : isSuccess ? 'Created!' : 'Reorder'}
        </span>
      )}
    </Button>
  );

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>Repeat this order</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
