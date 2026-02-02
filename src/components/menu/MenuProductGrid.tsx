import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import Info from "lucide-react/dist/esm/icons/info";
import { ProductDetailDialog } from './ProductDetailDialog';
import { useMenuCart } from '@/contexts/MenuCartContext';
import { toast } from '@/hooks/use-toast';

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

interface MenuProductGridProps {
  products: Product[];
  menuId: string;
  whitelistEntryId?: string;
}

export function MenuProductGrid({ products, menuId, whitelistEntryId }: MenuProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { items, addItem } = useMenuCart();

  const addToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
    });
    toast({
      title: 'Added to Cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const getCartQuantity = (productId: string) => {
    const item = items.find(i => i.productId === productId);
    return item?.quantity || 0;
  };

  if (products.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No products available in this menu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const quantity = getCartQuantity(product.id);
          const isOutOfStock = product.stock_status === 'out_of_stock';

          return (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square relative bg-muted">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Badge variant="secondary" className="text-lg">Out of Stock</Badge>
                  </div>
                )}
              </div>

              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>

                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {product.strain_type && (
                      <Badge variant="outline" className="text-xs">
                        {product.strain_type}
                      </Badge>
                    )}
                    {product.thc_content && (
                      <Badge variant="outline" className="text-xs">
                        THC: {product.thc_content}
                      </Badge>
                    )}
                    {product.cbd_content && (
                      <Badge variant="outline" className="text-xs">
                        CBD: {product.cbd_content}
                      </Badge>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {quantity > 0 ? `Add More (${quantity})` : 'Add to Cart'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={() => {
            addToCart(selectedProduct);
            setSelectedProduct(null);
          }}
        />
      )}
    </>
  );
}
