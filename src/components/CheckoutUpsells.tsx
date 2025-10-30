import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultWeight } from "@/utils/productHelpers";
import { cleanProductName } from "@/utils/productName";

interface CheckoutUpsellsProps {
  cartItems: any[];
}

const CheckoutUpsells = ({ cartItems }: CheckoutUpsellsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addingProduct, setAddingProduct] = useState<string | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Get categories from cart items
  const cartCategories = [...new Set(cartItems.map(item => item.products?.category))];
  const cartProductIds = cartItems.map(item => item.product_id);

  // Fetch recommended products based on cart
  const { data: upsellProducts = [] } = useQuery({
    queryKey: ["upsell-products", cartCategories],
    queryFn: async () => {
      // Get complementary products (different categories than in cart)
      const complementaryCategories = ["edibles", "vapes", "pre-rolls", "concentrates"]
        .filter(cat => !cartCategories.includes(cat));

      if (complementaryCategories.length === 0) {
        // If cart has all categories, show popular items
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("in_stock", true)
          .not("id", "in", `(${cartProductIds.join(",")})`)
          .order("review_count", { ascending: false })
          .limit(4);
        
        if (error) throw error;
        return data || [];
      }

      // Fetch products from complementary categories
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("in_stock", true)
        .in("category", complementaryCategories)
        .not("id", "in", `(${cartProductIds.join(",")})`)
        .order("average_rating", { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data || [];
    },
    enabled: cartItems.length > 0,
  });

  const handleAddUpsell = async (product: any) => {
    if (!user || addedProducts.has(product.id)) return;

    setAddingProduct(product.id);
    try {
      const defaultWeight = getDefaultWeight(product.prices);

      const { data: existing } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .eq("selected_weight", defaultWeight)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1,
            selected_weight: defaultWeight,
          });
        
        if (error) throw error;
      }

      toast.success(`${product.name} added to cart!`);
      setAddedProducts(prev => new Set(prev).add(product.id));
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add product");
    } finally {
      setAddingProduct(null);
    }
  };

  const getProductPrice = (product: any) => {
    if (product.prices && typeof product.prices === 'object') {
      return Math.min(...Object.values(product.prices).map(p => Number(p)));
    }
    return Number(product.price);
  };

  if (upsellProducts.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <span>🎁</span>
          Frequently Bought Together
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customers who bought these items also added:
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {upsellProducts.map((product) => {
            const isAdded = addedProducts.has(product.id);
            const isAdding = addingProduct === product.id;
            const price = getProductPrice(product);

            return (
              <div
                key={product.id}
                className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-20 h-20 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl flex items-center justify-center h-full">🌿</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{cleanProductName(product.name)}</h4>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {product.category}
                      </Badge>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold">${price.toFixed(2)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleAddUpsell(product)}
                    disabled={isAdding || isAdded}
                    variant={isAdded ? "secondary" : "default"}
                  >
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : isAdded ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        Add to Order
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckoutUpsells;
