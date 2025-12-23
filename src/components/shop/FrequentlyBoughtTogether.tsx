/**
 * Frequently Bought Together
 * Shows products commonly purchased with the current product
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useState, useMemo } from 'react';
import { useShopCart } from '@/hooks/useShopCart';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FrequentlyBoughtTogetherProps {
  productId: string;
  storeId: string;
  currentProductPrice: number;
  currentProductName: string;
  currentProductImage?: string | null;
  primaryColor: string;
  className?: string;
}

interface RelatedProduct {
  product_id: string;
  product_name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
}

export function FrequentlyBoughtTogether({
  productId,
  storeId,
  currentProductPrice,
  currentProductName,
  currentProductImage,
  primaryColor,
  className,
}: FrequentlyBoughtTogetherProps) {
  const { storeSlug } = useParams();
  const { toast } = useToast();
  const { addItem } = useShopCart({ storeId });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isAddingAll, setIsAddingAll] = useState(false);

  // Fetch related products (same category, different product)
  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['frequently-bought', storeId, productId],
    queryFn: async () => {
      // Get current product's category first
      const { data: allProducts, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: storeId });

      if (error) throw error;

      const products = allProducts as RelatedProduct[];
      const currentProduct = products.find(p => p.product_id === productId);
      
      if (!currentProduct?.category) {
        // If no category, return random popular products
        return products
          .filter(p => p.product_id !== productId && p.stock_quantity > 0)
          .slice(0, 3);
      }

      // Get products from same category
      const sameCategoryProducts = products
        .filter(p => 
          p.product_id !== productId && 
          p.category === currentProduct.category &&
          p.stock_quantity > 0
        )
        .slice(0, 2);

      // If not enough in category, add from other categories
      if (sameCategoryProducts.length < 2) {
        const otherProducts = products
          .filter(p => 
            p.product_id !== productId && 
            p.category !== currentProduct.category &&
            p.stock_quantity > 0
          )
          .slice(0, 3 - sameCategoryProducts.length);
        
        return [...sameCategoryProducts, ...otherProducts];
      }

      return sameCategoryProducts;
    },
    enabled: !!storeId && !!productId,
  });

  // Initialize selection when products load
  useMemo(() => {
    if (relatedProducts.length > 0 && selectedProducts.size === 0) {
      setSelectedProducts(new Set(relatedProducts.map(p => p.product_id)));
    }
  }, [relatedProducts]);

  const toggleProduct = (productIdToToggle: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productIdToToggle)) {
      newSelected.delete(productIdToToggle);
    } else {
      newSelected.add(productIdToToggle);
    }
    setSelectedProducts(newSelected);
  };

  // Calculate bundle price
  const bundleTotal = useMemo(() => {
    let total = currentProductPrice;
    relatedProducts.forEach(p => {
      if (selectedProducts.has(p.product_id)) {
        total += p.sale_price || p.price;
      }
    });
    return total;
  }, [selectedProducts, relatedProducts, currentProductPrice]);

  // Calculate savings (5% bundle discount)
  const bundleDiscount = bundleTotal * 0.05;
  const finalPrice = bundleTotal - bundleDiscount;

  const handleAddAllToCart = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: 'No products selected',
        description: 'Please select at least one product to add.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingAll(true);
    try {
      // Add each selected product
      for (const product of relatedProducts) {
        if (selectedProducts.has(product.product_id)) {
          addItem({
            productId: product.product_id,
            quantity: 1,
            price: product.sale_price || product.price,
            name: product.product_name,
            imageUrl: product.image_url,
          });
        }
      }

      toast({
        title: 'Bundle added to cart!',
        description: `${selectedProducts.size} items added. You save ${formatCurrency(bundleDiscount)}!`,
      });
    } finally {
      setIsAddingAll(false);
    }
  };

  if (relatedProducts.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
          Frequently Bought Together
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Products Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Current Product (always selected) */}
          <div className="flex flex-col items-center gap-2 p-2 rounded-lg bg-muted/50">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
              {currentProductImage ? (
                <img
                  src={currentProductImage}
                  alt={currentProductName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-center line-clamp-1 max-w-[80px]">
              {currentProductName}
            </span>
            <span className="text-xs font-semibold" style={{ color: primaryColor }}>
              {formatCurrency(currentProductPrice)}
            </span>
          </div>

          {/* Related Products */}
          {relatedProducts.map((product, index) => (
            <div key={product.product_id} className="flex items-center gap-3">
              <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div
                className={cn(
                  'flex flex-col items-center gap-2 p-2 rounded-lg transition-all cursor-pointer',
                  selectedProducts.has(product.product_id)
                    ? 'bg-primary/10 ring-2 ring-primary/30'
                    : 'bg-muted/30 opacity-60'
                )}
                onClick={() => toggleProduct(product.product_id)}
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-1 -left-1">
                    <Checkbox
                      checked={selectedProducts.has(product.product_id)}
                      onCheckedChange={() => toggleProduct(product.product_id)}
                      className="bg-background"
                    />
                  </div>
                </div>
                <Link
                  to={`/shop/${storeSlug}/products/${product.product_id}`}
                  className="text-xs font-medium text-center line-clamp-1 max-w-[80px] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {product.product_name}
                </Link>
                <span className="text-xs font-semibold" style={{ color: primaryColor }}>
                  {formatCurrency(product.sale_price || product.price)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bundle Summary */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(bundleTotal)}
              </span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Save 5%
              </Badge>
            </div>
            <div className="text-xl font-bold" style={{ color: primaryColor }}>
              {formatCurrency(finalPrice)}
            </div>
            <p className="text-xs text-muted-foreground">
              Bundle price for {selectedProducts.size + 1} items
            </p>
          </div>
          <Button
            onClick={handleAddAllToCart}
            disabled={isAddingAll || selectedProducts.size === 0}
            style={{ backgroundColor: primaryColor }}
            className="gap-2"
          >
            {isAddingAll ? (
              <span className="animate-spin">●</span>
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            Add Bundle to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default FrequentlyBoughtTogether;
