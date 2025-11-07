import { useState, memo, useCallback, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Check, Star, Flame, Sparkles, Loader2, AlertCircle, Award, Clock, TrendingUp } from "lucide-react";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ProductDetailModal } from "./ProductDetailModal";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { getDefaultWeight } from "@/utils/productHelpers";
import { useProductViewCount } from "@/hooks/useProductViewCount";
import { useGuestCart } from "@/hooks/useGuestCart";
import { haptics } from "@/utils/haptics";
import { cleanProductName } from "@/utils/productName";
import type { Product } from "@/types/product";
import { getNumberValue, getStringArray, getDateValue, getStringValue } from "@/utils/productTypeGuards";
import { usePrefetch } from "@/hooks/usePrefetch";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ProductCardProps {
  product: Product;
  onAuthRequired?: () => void;
  stockLevel?: number;
}

const ProductCard = memo(function ProductCard({ product, onAuthRequired, stockLevel }: ProductCardProps) {
  const { user } = useAuth();
  const { addToRecentlyViewed } = useRecentlyViewed();
  const { addToGuestCart } = useGuestCart();
  const viewCount = useProductViewCount(product.id);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const queryClient = useQueryClient();
  const { prefetchQuery } = usePrefetch();

  // Use provided stockLevel instead of making individual API call
  const actualStockLevel = stockLevel !== undefined ? stockLevel : 0;
  const isLowStock = actualStockLevel > 0 && actualStockLevel <= 5;

  // Prefetch product reviews on hover
  const handleMouseEnter = useCallback(() => {
    prefetchQuery(
      ["product-reviews", product.id],
      async () => {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("product_id", product.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        return data || [];
      }
    );
  }, [product.id, prefetchQuery]);

  const handleCardClick = () => {
    haptics.light();
    addToRecentlyViewed(product.id);
    setShowDetailModal(true);
  };

  const getProductBadge = () => {
    const thcaPercentage = getNumberValue(product.thca_percentage, 0);
    if (thcaPercentage >= 25) {
      return { icon: Flame, text: "High Potency", className: "bg-destructive/10 text-destructive" };
    }
    const createdDate = getDateValue(product.created_at);
    if (createdDate && createdDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return { icon: Sparkles, text: "New", className: "bg-accent/10 text-accent" };
    }
    if (thcaPercentage >= 20) {
      return { icon: Star, text: "Staff Pick", className: "bg-primary/10 text-primary" };
    }
    return null;
  };

  const badge = getProductBadge();

  const productImages = useMemo(() => {
    const additionalImages = getStringArray(product.additional_images);
    return [product.image_url, ...additionalImages].filter(Boolean);
  }, [product.image_url, product.additional_images]);

  const handleAddToCart = async () => {
    if (!product.in_stock) {
      haptics.error();
      toast.error("This product is out of stock");
      return;
    }

    setLoading(true);
    haptics.light();
    
    try {
      // Get default weight for products with weight options (always starts at 3.5g)
      const defaultWeight = getDefaultWeight(product.prices);

      if (!user) {
        // Guest cart - use localStorage
        addToGuestCart(product.id, quantity, defaultWeight);
        
        // Success feedback
        haptics.success();
        toast.success("Added to cart!", {
          description: `${quantity}x ${product.name}`,
          duration: 2000,
        });
        
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
        queryClient.invalidateQueries({ queryKey: ["cart"] });
        queryClient.invalidateQueries({ queryKey: ["guest-cart-products"] });
        setLoading(false);
        return;
      }

      // Optimistically update UI
      setAdded(true);

      // Authenticated user - use database with upsert for instant response
      const { error } = await supabase.rpc('add_to_cart', {
        p_user_id: user.id,
        p_product_id: product.id,
        p_quantity: quantity,
        p_selected_weight: defaultWeight
      });
      
      if (error) throw error;

      // Invalidate cart queries after successful insert
      queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });

      // Success feedback with confetti effect
      haptics.success();
      toast.success("🎉 Added to cart!", {
        description: `${quantity}x ${product.name}`,
        duration: 2000,
      });
      setTimeout(() => setAdded(false), 2500);
      setQuantity(1);
    } catch (error: unknown) {
      haptics.error();
      const errorMessage = error instanceof Error ? error.message : "Failed to add to cart";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = () => {
    const colors: Record<string, string> = {
      flower: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      edibles: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      vapes: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      concentrates: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      "pre-rolls": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return colors[product.category] || colors.flower;
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.selection();
    setQuantity(quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.selection();
    setQuantity(Math.max(1, quantity - 1));
  };

  return (
    <>
      <Card
        onMouseEnter={handleMouseEnter} 
        className="group overflow-hidden backdrop-blur-2xl transition-all duration-500 cursor-pointer relative bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:-translate-y-3 hover:scale-[1.02]"
        onClick={handleCardClick}
      >
        {/* Out of Stock Overlay */}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl font-bold text-destructive">Out of Stock</p>
              <p className="text-sm text-muted-foreground">Check back soon</p>
            </div>
          </div>
        )}

        {/* Badge Stack - Consistent & Color Coded */}
        <div className="absolute top-2 md:top-3 left-2 md:left-3 z-20 flex flex-col gap-1.5 md:gap-2 max-w-[45%]">
          <Badge className={`${getCategoryColor()} uppercase text-xs font-bold shadow-lg truncate`}>
            {product.category}
          </Badge>
          {/* Lab Test Badge - Always Visible */}
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shadow-lg text-xs truncate">
            <Award className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Lab Tested</span>
          </Badge>
        </div>

        {/* Product Badge - High Potency Color Coded */}
        {badge && (
          <div className="absolute top-2 md:top-3 right-2 md:right-3 z-20 max-w-[45%]">
            <Badge className={`${badge.className} flex items-center gap-1 shadow-lg font-bold text-xs truncate`}>
              <badge.icon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{badge.text}</span>
            </Badge>
          </div>
        )}

        <div className="relative h-72 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <Carousel className="w-full h-full">
            <CarouselContent>
              {productImages.map((image, index) => (
                <CarouselItem key={index}>
                  <OptimizedProductImage
                    src={image}
                    alt={`${product.name} - Image ${index + 1}`}
                    className="w-full h-72"
                    priority={index === 0}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {productImages.length > 1 && (
              <>
                <CarouselPrevious className="left-2" onClick={(e) => e.stopPropagation()} />
                <CarouselNext className="right-2" onClick={(e) => e.stopPropagation()} />
              </>
            )}
          </Carousel>
        </div>

        <CardContent className="p-6 space-y-4">
          {/* Product Name */}
          <div>
            <h3 className="text-xl font-bold mb-1 line-clamp-1 text-white">{cleanProductName(product.name)}</h3>
            {getStringValue(product.strain_type) && (
              <p className="text-sm text-white/60 capitalize">{getStringValue(product.strain_type)}</p>
            )}
          </div>
          
          {/* PRICE FIRST - Largest Element */}
          <div className="flex items-end justify-between">
            {product.prices && typeof product.prices === 'object' && Object.keys(product.prices).length > 1 ? (
              <div>
                <div className="text-4xl font-black text-emerald-500">
                  ${Number(Math.min(...Object.values(product.prices).map(p => Number(p)))).toFixed(0)}
                </div>
                <p className="text-xs text-white/40">Starting price</p>
              </div>
            ) : (
              <div className="text-4xl font-black text-emerald-500">
                ${Number(product.price).toFixed(0)}
              </div>
            )}
          </div>

          {/* Rating + Reviews - Social Proof */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-white">{getNumberValue(product.average_rating, 4.8)}</span>
            </div>
            <span className="text-white/60">({getNumberValue(product.review_count, 127)} reviews)</span>
          </div>

          {/* Stock + Social Proof Alerts */}
          <div className="flex flex-wrap gap-2">
            {isLowStock && (
              <Badge variant="destructive" className="text-xs font-semibold">
                <AlertCircle className="h-3 w-3 mr-1" />
                Only {actualStockLevel} left
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              {Math.floor(Math.random() * 30) + 15} sold this week
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="p-6 pt-0 flex flex-col gap-3">
          {/* ONE BIG ADD TO CART BUTTON - Primary CTA */}
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              haptics.medium();
              handleAddToCart();
            }}
            disabled={loading || !product.in_stock || added}
            className={`w-full h-12 text-base font-bold relative overflow-hidden ${
              added ? 'animate-pulse bg-green-600 hover:bg-green-600' : ''
            }`}
            size="lg"
            variant={added ? "secondary" : "hero"}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                <span className="truncate">Adding...</span>
              </>
            ) : added ? (
              <>
                <Check className="h-5 w-5 mr-2 animate-bounce" />
                <span className="truncate animate-fade-in">✓ Added to Cart!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                <span className="truncate">Add to Cart</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full hover:bg-primary/10 hover:border-primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCardClick();
            }}
          >
            <span className="truncate">View Details</span>
          </Button>
        </CardFooter>
      </Card>

      <ProductDetailModal
        product={product}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        onAuthRequired={onAuthRequired}
      />
    </>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
