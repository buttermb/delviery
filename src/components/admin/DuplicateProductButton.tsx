/**
 * DuplicateProductButton - One-click to clone a product
 * Reduces friction: Creates "Copy of [Product]" with all fields
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
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  category?: string;
  description?: string;
  [key: string]: unknown;
}

interface DuplicateProductButtonProps {
  product: Product;
  onDuplicate: (product: Product) => Promise<{ id: string; name: string }>;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function DuplicateProductButton({
  product,
  onDuplicate,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: DuplicateProductButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      const duplicatedProduct = {
        ...product,
        id: '', // Will be generated
        name: `Copy of ${product.name}`,
        sku: product.sku ? `${product.sku}-COPY` : undefined,
      };

      const result = await onDuplicate(duplicatedProduct);
      setIsSuccess(true);
      toast.success(`Created "${result.name}"`, {
        action: {
          label: 'View',
          onClick: () => {
            // Navigation to new product would be handled by parent
          },
        },
      });
      
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      toast.error('Failed to duplicate product. Please try again.', { description: humanizeError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleDuplicate}
      disabled={isLoading}
      className={className}
      {...(!showLabel ? { 'aria-label': 'Duplicate product' } : {})}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSuccess ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isLoading ? 'Duplicating...' : isSuccess ? 'Duplicated!' : 'Duplicate'}
        </span>
      )}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent>
          <p>Duplicate this product</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
