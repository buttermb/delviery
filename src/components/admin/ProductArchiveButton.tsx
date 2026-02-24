/**
 * ProductArchiveButton - Soft delete (archive) and restore products
 *
 * Provides archive/restore functionality with visual feedback:
 * - Archive: Soft-deletes a product (sets deleted_at timestamp)
 * - Restore: Restores an archived product (clears deleted_at)
 *
 * Products with existing orders cannot be hard-deleted,
 * so archiving is the preferred approach.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Archive from "lucide-react/dist/esm/icons/archive";
import ArchiveRestore from "lucide-react/dist/esm/icons/archive-restore";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Check from "lucide-react/dist/esm/icons/check";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface Product {
  id: string;
  name: string;
  is_active?: boolean;
  [key: string]: unknown;
}

interface ProductArchiveButtonProps {
  product: Product;
  tenantId: string;
  onSuccess?: (product: Product, isArchived: boolean) => void;
  variant?: 'default' | 'ghost' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function ProductArchiveButton({
  product,
  tenantId,
  onSuccess,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: ProductArchiveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isArchived = product.is_active === false;
  const action = isArchived ? 'restore' : 'archive';

  const handleAction = async () => {
    setIsLoading(true);
    try {
      if (isArchived) {
        // Restore the product - set is_active to true
        const { error } = await supabase
          .from('products')
          .update({ is_active: true } as unknown as Record<string, unknown>)
          .eq('id', product.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        setIsSuccess(true);
        toast.success(`"${product.name}" restored`, {
          description: 'Product is now active and visible again.',
        });

        onSuccess?.(product, false);
      } else {
        // Archive the product - set is_active to false
        const { error } = await supabase
          .from('products')
          .update({ is_active: false } as unknown as Record<string, unknown>)
          .eq('id', product.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        setIsSuccess(true);
        toast.success(`"${product.name}" archived`, {
          description: 'Product hidden from active inventory. Can be restored anytime.',
          action: {
            label: 'Undo',
            onClick: async () => {
            // Quick undo - restore the product
              const { error: restoreError } = await supabase
                .from('products')
                .update({ is_active: true } as unknown as Record<string, unknown>)
                .eq('id', product.id)
                .eq('tenant_id', tenantId);

              if (restoreError) {
                toast.error('Failed to undo archive');
                return;
              }

              toast.success('Product restored');
              onSuccess?.(product, false);
            },
          },
        });

        onSuccess?.(product, true);
      }

      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      logger.error(`Failed to ${action} product`, error, {
        component: 'ProductArchiveButton',
        productId: product.id,
      });
      toast.error(`Failed to ${action} product. Please try again.`, { description: humanizeError(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isSuccess) {
      return <Check className="h-4 w-4 text-success" />;
    }
    return isArchived ? (
      <ArchiveRestore className="h-4 w-4" />
    ) : (
      <Archive className="h-4 w-4" />
    );
  };

  const getLabel = () => {
    if (isLoading) {
      return isArchived ? 'Restoring...' : 'Archiving...';
    }
    if (isSuccess) {
      return isArchived ? 'Restored!' : 'Archived!';
    }
    return isArchived ? 'Restore' : 'Archive';
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleAction}
      disabled={isLoading}
      className={className}
    >
      {getIcon()}
      {showLabel && <span className="ml-1">{getLabel()}</span>}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>
            {isArchived
              ? 'Restore this product to active inventory'
              : 'Archive this product (can be restored later)'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
