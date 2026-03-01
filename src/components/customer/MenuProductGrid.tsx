import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Minus, Loader2 } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { cleanProductName } from '@/utils/productName';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  stock?: number; // Legacy field, prefer stock_quantity
  stock_quantity?: number;
  min_quantity: number;
  type?: string;
  thc_content?: string;
  description?: string;
}

interface MenuProductGridProps {
  products: Product[];
  showImages: boolean;
  showAvailability: boolean;
  onAddToCart: (productId: string, quantity: number) => void;
  minOrderQty?: number;
}

export const MenuProductGrid = ({
  products,
  showImages,
  showAvailability: _showAvailability,
  onAddToCart,
  minOrderQty: _minOrderQty = 1
}: MenuProductGridProps) => {
  const [searchQuery, _setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const filteredProducts = products.filter(product =>
    cleanProductName(product.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuantityChange = (productId: string, delta: number, min: number, max: number) => {
    setQuantities(prev => {
      const current = prev[productId] || min;
      const next = Math.min(Math.max(current + delta, min), max);
      return { ...prev, [productId]: next };
    });
  };

  const handleAddToCart = (product: Product) => {
    const qty = quantities[product.id] || product.min_quantity;
    if (qty >= product.min_quantity) {
      setAnimatingId(product.id);
      onAddToCart(product.id, qty);

      // Reset after animation
      setTimeout(() => {
        setAnimatingId(null);
        setQuantities(prev => ({ ...prev, [product.id]: 0 }));
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search - Only show if not handled by parent (optional, keeping for compatibility) */}
      {/* <div className="relative"> ... </div> */}

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const qty = quantities[product.id] || product.min_quantity;
          const maxStock = product.stock_quantity || product.stock || 0;
          const isValidQty = qty >= product.min_quantity && qty <= maxStock;
          const isAnimating = animatingId === product.id;

          return (
            <Card
              key={product.id}
              className="group overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl bg-white ring-1 ring-gray-100"
            >
              {showImages && (
                <div className="relative h-56 overflow-hidden bg-gray-50">
                  {product.image_url ? (
                    <OptimizedImage
                      src={product.image_url}
                      alt={cleanProductName(product.name)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="h-12 w-12" />
                    </div>
                  )}

                  {/* Overlay Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.type && (
                      <Badge className="bg-white/90 text-black backdrop-blur-sm shadow-sm border-0 hover:bg-white">
                        {product.type}
                      </Badge>
                    )}
                  </div>

                  {!product.available && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                      <Badge variant="destructive" className="text-sm px-3 py-1">Out of Stock</Badge>
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 space-y-4">
                {/* Header */}
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold leading-tight text-gray-900 line-clamp-2">
                      {cleanProductName(product.name)}
                    </h3>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold text-primary block">
                        ${product.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">/lb</span>
                    </div>
                  </div>
                  {product.thc_content && (
                    <p className="text-xs font-medium text-emerald-600 mt-1">
                      THC: {product.thc_content}
                    </p>
                  )}
                </div>

                {/* Description (Optional) */}
                {product.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                )}

                {/* Actions */}
                <div className="pt-2 flex items-center gap-3">
                  {product.available ? (
                    <>
                      {/* Stepper */}
                      <div className="flex items-center bg-gray-100 rounded-full p-1">
                        <button
                          onClick={() => handleQuantityChange(product.id, -1, product.min_quantity, maxStock)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
                          disabled={qty <= product.min_quantity}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-gray-900">{qty}</span>
                        <button
                          onClick={() => handleQuantityChange(product.id, 1, product.min_quantity, maxStock)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
                          disabled={qty >= maxStock}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Add Button */}
                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={!isValidQty || isAnimating}
                        className={cn(
                          "flex-1 rounded-full font-semibold transition-all duration-300",
                          isAnimating
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-primary hover:bg-primary/90 text-white"
                        )}
                      >
                        {isAnimating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Added!
                          </>
                        ) : (
                          <>
                            Add
                            <span className="ml-1 opacity-80 text-xs font-normal">
                              (${(product.price * qty).toLocaleString()})
                            </span>
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button disabled variant="secondary" className="w-full rounded-full">
                      Unavailable
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No products found</p>
          <p className="text-sm text-gray-400">Try adjusting your search filters</p>
        </div>
      )}
    </div>
  );
};
