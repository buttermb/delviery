import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Package } from 'lucide-react';
import { cleanProductName } from '@/utils/productName';
import { formatWeight } from '@/utils/productHelpers';

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
  showAvailability,
  onAddToCart,
  minOrderQty = 1
}: MenuProductGridProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filteredProducts = products.filter(product =>
    cleanProductName(product.name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuantityChange = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const handleAddToCart = (product: Product) => {
    const qty = quantities[product.id] || product.min_quantity;
    if (qty >= product.min_quantity) {
      onAddToCart(product.id, qty);
      setQuantities(prev => ({ ...prev, [product.id]: 0 }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const qty = quantities[product.id] || product.min_quantity;
          const isValidQty = qty >= product.min_quantity && qty <= (product.stock_quantity || 0);

          return (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {showImages && product.image_url && (
                <div className="relative h-48 bg-muted">
                  <img
                    src={product.image_url}
                    alt={cleanProductName(product.name)}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {!product.available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="destructive">Out of Stock</Badge>
                    </div>
                  )}
                </div>
              )}

              <div className="p-6 space-y-4">
                {/* Product Info */}
                <div>
                  <h3 className="text-xl font-bold mb-1">
                    {cleanProductName(product.name)}
                  </h3>
                  {product.type && (
                    <p className="text-sm text-muted-foreground">{product.type}</p>
                  )}
                </div>

                {/* Price & Stock */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-bold text-primary">
                      ${product.price.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground ml-1">/lb</span>
                  </div>
                  {showAvailability && (
                    <Badge variant={product.available && (product.stock_quantity || 0) > 10 ? 'default' : 'secondary'}>
                      {product.available ? (
                        <>
                          <Package className="h-3 w-3 mr-1" />
                          {product.stock_quantity || 0} lbs
                        </>
                      ) : (
                        'Out of Stock'
                      )}
                    </Badge>
                  )}
                </div>

                {/* THC Content */}
                {product.thc_content && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">THC:</span>{' '}
                    <span className="font-medium">{product.thc_content}</span>
                  </div>
                )}

                {/* Quantity Input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={product.min_quantity}
                      max={product.stock_quantity || product.stock || 0}
                      value={qty}
                      onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                      disabled={!product.available}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">lbs</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min: {product.min_quantity} lbs
                  </p>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={() => handleAddToCart(product)}
                  disabled={!product.available || !isValidQty}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart - ${(product.price * qty).toLocaleString()}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No products found</p>
        </div>
      )}
    </div>
  );
};
