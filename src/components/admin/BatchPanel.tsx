/**
 * Batch Operations Panel
 * Shows scanned products and bulk actions
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, Trash2, Package, DollarSign } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface BatchPanelProps {
  products: Product[];
  onRemove: (productId: string) => void;
  onClear: () => void;
  onBatchDelete: () => void;
  onBatchEditPrice: () => void;
  isDeleting?: boolean;
}

export function BatchPanel({ products, onRemove, onClear, onBatchDelete, onBatchEditPrice, isDeleting }: BatchPanelProps) {
  if (products.length === 0) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] shadow-lg z-50">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Batch Operations</h3>
            <Badge variant="secondary">{products.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Product List */}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(product.id)}
                className="h-8 w-8 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={onClear}
            className="flex-1"
          >
            Clear
          </Button>
          <Button
            variant="default"
            onClick={onBatchEditPrice}
            className="flex-1 gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Edit Prices
          </Button>
          <Button
            variant="destructive"
            onClick={onBatchDelete}
            disabled={isDeleting}
            className="flex-1 gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
