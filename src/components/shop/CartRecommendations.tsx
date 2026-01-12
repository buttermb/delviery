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
  primaryColor: string; // Passed from parent, likely store.primary_color. Should we check if isLuxuryTheme is active here?
  className?: string;
  isLuxuryTheme?: boolean;
  accentColor?: string;
}

import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';

// Product interface replaced by MarketplaceProduct import

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
      const mixed = [...sameCategoryProducts, ...otherProducts].slice(0, 4);

      // Map to MarketplaceProduct
      return mixed.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        category: p.category || '',
        strain_type: p.strain_type || '', // Ensure field exists
        price: p.price,
        description: p.description || '',
        image_url: p.image_url,
        images: p.images || [],
        thc_content: p.thc_content,
        cbd_content: p.cbd_content,
        is_visible: true,
        display_order: 0,
        stock_quantity: p.stock_quantity,
        unit_type: p.unit_type,
        min_expiry_days: p.min_expiry_days
      })) as MarketplaceProduct[];
    },
    enabled: !!storeId && cartItems.length > 0,
  });

  const handleQuickAdd = (e: React.MouseEvent, product: MarketplaceProduct) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      productId: product.product_id,
      quantity: 1,
      price: product.price,
      name: product.product_name,
      imageUrl: product.image_url,
      minExpiryDays: product.min_expiry_days,
      variant: product.strain_type
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
          {recommendations.map((product, index) => (
            <div key={product.product_id} className="h-full">
              <StorefrontProductCard
                product={product}
                storeSlug={storeSlug!}
                isPreviewMode={false}
                onQuickAdd={(e) => handleQuickAdd(e, product)}
                isAdded={false}
                onToggleWishlist={() => { }}
                isInWishlist={false}
                onQuickView={() => { }}
                index={index}
                accentColor={primaryColor} // Fallback nicely
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default CartRecommendations;
