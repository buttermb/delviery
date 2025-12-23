/**
 * Cart Recommendations
 * "You might also like" section for the cart page
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useShopCart, ShopCartItem } from '@/hooks/useShopCart';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CartRecommendationsProps {
  storeId: string;
  cartItems: ShopCartItem[];
  primaryColor: string;
  className?: string;
}

interface Product {
  product_id: string;
  product_name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
}

export function CartRecommendations({
  storeId,
  cartItems,
  primaryColor,
  className,
}: CartRecommendationsProps) {
  const { storeSlug } = useParams();
  const { toast } = useToast();
  const { addItem } = useShopCart({ storeId });

  // Get cart product IDs and categories
  const cartProductIds = cartItems.map(item => item.productId);

  // Fetch recommendations based on cart items
  const { data: recommendations = [] } = useQuery({
    queryKey: ['cart-recommendations', storeId, cartProductIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: storeId });

      if (error) throw error;

      const products = data as Product[];
      
      // Filter out items already in cart and out of stock items
      const availableProducts = products.filter(
        p => !cartProductIds.includes(p.product_id) && p.stock_quantity > 0
      );

      // Get categories from cart items
      const cartProducts = products.filter(p => cartProductIds.includes(p.product_id));
      const cartCategories = [...new Set(cartProducts.map(p => p.category).filter(Boolean))];

      // Prioritize products from same categories
      const sameCategoryProducts = availableProducts.filter(
        p => cartCategories.includes(p.category)
      );
      const otherProducts = availableProducts.filter(
        p => !cartCategories.includes(p.category)
      );

      // Return mix of same category and other products
      return [...sameCategoryProducts, ...otherProducts].slice(0, 4);
    },
    enabled: !!storeId && cartItems.length > 0,
  });

  const handleQuickAdd = (product: Product) => {
    addItem({
      productId: product.product_id,
      quantity: 1,
      price: product.sale_price || product.price,
      name: product.product_name,
      imageUrl: product.image_url,
    });

    toast({
      title: 'Added to cart',
      description: product.product_name,
    });
  };

  if (recommendations.length === 0) return null;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
          You Might Also Like
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {recommendations.map((product) => {
            const displayPrice = product.sale_price || product.price;
            const hasDiscount = product.sale_price && product.sale_price < product.price;

            return (
              <div
                key={product.product_id}
                className="group flex flex-col rounded-lg border bg-card p-2 transition-all hover:shadow-md"
              >
                <Link
                  to={`/shop/${storeSlug}/products/${product.product_id}`}
                  className="relative aspect-square rounded-md overflow-hidden bg-muted mb-2"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  {hasDiscount && (
                    <Badge
                      className="absolute top-1 left-1 text-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Sale
                    </Badge>
                  )}
                </Link>

                <Link
                  to={`/shop/${storeSlug}/products/${product.product_id}`}
                  className="text-sm font-medium line-clamp-2 hover:underline mb-1"
                >
                  {product.product_name}
                </Link>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(displayPrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.price)}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-auto gap-1"
                  onClick={() => handleQuickAdd(product)}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default CartRecommendations;
