import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  strain_type?: string;
  thc_content?: string;
  cbd_content?: string;
  image_url?: string;
  stock_status?: string;
}

interface ProductDetailDialogProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onAddToCart: () => void;
}

export function ProductDetailDialog({
  product,
  open,
  onClose,
  onAddToCart,
}: ProductDetailDialogProps) {
  const isOutOfStock = product.stock_status === 'out_of_stock';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image */}
          <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-20 w-20 text-muted-foreground" />
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Badge variant="secondary" className="text-lg">Out of Stock</Badge>
              </div>
            )}
          </div>

          {/* Price and Badges */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-primary">
                ${product.price.toFixed(2)}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {product.strain_type && (
                  <Badge variant="outline">{product.strain_type}</Badge>
                )}
                {product.thc_content && (
                  <Badge variant="outline">THC: {product.thc_content}</Badge>
                )}
                {product.cbd_content && (
                  <Badge variant="outline">CBD: {product.cbd_content}</Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onAddToCart} disabled={isOutOfStock}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
