/**
 * OrderDuplicateButton - One-click to clone an order
 * Creates a new order with the same customer info, items, and details
 * as the original. Sets status to 'pending' for review.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOrderDuplicate } from '@/hooks/useOrderDuplicate';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number?: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string;
  delivery_borough?: string;
  delivery_notes?: string | null;
  delivery_fee?: number;
  payment_method?: string;
  subtotal?: number;
  total_amount?: number;
  tip_amount?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  special_instructions?: string | null;
  order_type?: string | null;
  requires_id_check?: boolean | null;
  order_items?: OrderItem[];
}

interface OrderDuplicateButtonProps {
  order: Order;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
  navigateToNew?: boolean;
  onSuccess?: (result: { id: string; order_number: string }) => void;
}

export function OrderDuplicateButton({
  order,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
  navigateToNew = false,
  onSuccess,
}: OrderDuplicateButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const { duplicateOrder, isLoading } = useOrderDuplicate({
    navigateToNew,
    onSuccess: (result) => {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      onSuccess?.(result);
    },
  });

  const handleDuplicate = () => {
    duplicateOrder(order);
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleDuplicate}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showSuccess ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isLoading ? 'Duplicating...' : showSuccess ? 'Duplicated!' : 'Duplicate'}
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
            <p>Duplicate this order</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
