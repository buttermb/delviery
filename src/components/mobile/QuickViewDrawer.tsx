import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cleanProductName } from "@/utils/productName";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptimizedProductImage } from "@/components/OptimizedProductImage";
import { ShoppingCart, X, Star, Award } from "lucide-react";
import { useState } from "react";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestCart } from "@/hooks/useGuestCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getDefaultWeight } from "@/utils/productHelpers";

interface QuickViewDrawerProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewFull?: () => void;
}

export function QuickViewDrawer({ product, open, onOpenChange, onViewFull }: QuickViewDrawerProps) {
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleAddToCart = async () => {
    setLoading(true);
    haptics.medium();

    try {
      const defaultWeight = getDefaultWeight(product.prices);

      if (!user) {
        addToGuestCart(product.id, quantity, defaultWeight);
        haptics.success();
        toast.success("Added to cart!", {
          description: `${quantity}x ${product.name}`,
        });
        queryClient.invalidateQueries({ queryKey: ["cart"] });
        onOpenChange(false);
      } else {
        const { error } = await supabase.rpc('add_to_cart', {
          p_user_id: user.id,
          p_product_id: product.id,
          p_quantity: quantity,
          p_selected_weight: defaultWeight
        });

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["cart"] });
        haptics.success();
        toast.success("🎉 Added to cart!", {
          description: `${quantity}x ${product.name}`,
        });
        onOpenChange(false);
      }
    } catch (error: any) {
      haptics.error();
      toast.error(error.message || "Failed to add to cart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-3xl p-0 overflow-hidden"
      >
        <div className="relative h-full flex flex-col">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-10 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={() => {
              haptics.light();
              onOpenChange(false);
            }}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Image */}
          <div className="relative h-64 flex-shrink-0">
            <OptimizedProductImage
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              priority
            />
            
            {/* Badges */}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className="bg-primary text-primary-foreground">
                <Award className="w-3 h-3 mr-1" />
                Lab Tested
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <SheetHeader>
              <SheetTitle className="text-2xl">{cleanProductName(product.name)}</SheetTitle>
              {product.strain_type && (
                <p className="text-muted-foreground capitalize">{product.strain_type}</p>
              )}
            </SheetHeader>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary">
                ${Number(product.price).toFixed(2)}
              </span>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{product.average_rating || 4.8}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                ({product.review_count || 127} reviews)
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground line-clamp-3">{product.description}</p>
            )}

            {/* View Full Button */}
            {onViewFull && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  haptics.light();
                  onViewFull();
                  onOpenChange(false);
                }}
              >
                View Full Details
              </Button>
            )}
          </div>

          {/* Sticky Add to Cart */}
          <div className="border-t bg-background p-4 flex-shrink-0">
            <Button
              className="w-full h-14 text-lg font-bold"
              size="lg"
              variant="hero"
              onClick={handleAddToCart}
              disabled={loading || !product.in_stock}
            >
              {loading ? (
                "Adding..."
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart - ${Number(product.price).toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
