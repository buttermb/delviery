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
import { formatCurrency } from '@/lib/formatters';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  prices?: Record<string, number>;
  strain_type?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  thc_content?: string;
  cbd_content?: string;
  image_url?: string;
  stock_status?: string;
  terpenes?: Array<{ name: string; percentage: number }>;
  effects?: string[];
  flavors?: string[];
  lineage?: string;
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
                loading="lazy"
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
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-bold text-primary">
                  {product.prices && Object.keys(product.prices).length > 0 
                    ? `${formatCurrency(Math.min(...Object.values(product.prices)))}+`
                    : formatCurrency(product.price)
                  }
                </div>
                {product.lineage && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Lineage: {product.lineage}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {product.strain_type && (
                  <Badge 
                    className={`${
                      product.strain_type === 'Indica' ? 'bg-purple-500/10 dark:bg-purple-500/5 text-purple-700 dark:text-purple-400 border-purple-500/20' :
                      product.strain_type === 'Sativa' ? 'bg-primary/10 text-primary border-primary/20' :
                      product.strain_type === 'Hybrid' ? 'bg-orange-500/10 dark:bg-orange-500/5 text-orange-700 dark:text-orange-400 border-orange-500/20' :
                      'bg-accent/10 text-accent-foreground border-accent/20'
                    }`}
                  >
                    {product.strain_type}
                  </Badge>
                )}
              </div>
            </div>

            {/* THC/CBD Info */}
            {(product.thc_percentage || product.cbd_percentage || product.thc_content || product.cbd_content) && (
              <div className="grid grid-cols-2 gap-3">
                {(product.thc_percentage || product.thc_content) && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">THC Content</div>
                    <div className="text-xl font-bold text-primary">
                      {product.thc_percentage ? `${product.thc_percentage.toFixed(1)}%` : product.thc_content}
                    </div>
                  </div>
                )}
                {(product.cbd_percentage || product.cbd_content) && (
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="text-xs text-muted-foreground mb-1">CBD Content</div>
                    <div className="text-xl font-bold text-accent-foreground">
                      {product.cbd_percentage ? `${product.cbd_percentage.toFixed(1)}%` : product.cbd_content}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Terpene Profile */}
            {product.terpenes && product.terpenes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Terpene Profile</h3>
                <div className="space-y-2">
                  {product.terpenes.map((terpene, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{terpene.name}</span>
                      <div className="flex items-center gap-2 flex-1 mx-4">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${(terpene.percentage / 2) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {terpene.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Effects */}
            {product.effects && product.effects.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Effects</h3>
                <div className="grid grid-cols-2 gap-2">
                  {product.effects.map(effect => (
                    <div key={effect} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <div className="text-lg">
                        {effect === 'Relaxed' && '😌'}
                        {effect === 'Happy' && '😊'}
                        {effect === 'Euphoric' && '🤩'}
                        {effect === 'Uplifted' && '⬆️'}
                        {effect === 'Creative' && '🎨'}
                        {effect === 'Energetic' && '⚡'}
                        {effect === 'Focused' && '🎯'}
                        {effect === 'Sleepy' && '😴'}
                        {effect === 'Hungry' && '🍕'}
                      </div>
                      <span className="text-sm font-medium">{effect}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flavors */}
            {product.flavors && product.flavors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Flavor Profile</h3>
                <div className="flex flex-wrap gap-2">
                  {product.flavors.map(flavor => (
                    <Badge key={flavor} variant="outline" className="px-3 py-1">
                      {flavor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

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
