import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface QuickReorderButtonProps {
  orderId: string;
  orderItems: Array<{
    product_id: string;
    quantity: number;
    selected_weight?: string;
  }>;
  disabled?: boolean;
}

export function QuickReorderButton({ orderId, orderItems, disabled }: QuickReorderButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleQuickReorder = async () => {
    if (!user) {
      toast.error("Please sign in to reorder");
      navigate("/");
      return;
    }

    if (disabled) return;

    try {
      // Get product details for the items
      const productIds = orderItems.map(item => item.product_id);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, in_stock")
        .in("id", productIds);

      if (productsError) throw productsError;

      const outOfStockProducts = products?.filter(p => !p.in_stock) || [];
      if (outOfStockProducts.length > 0) {
        toast.error(`${outOfStockProducts.length} item(s) out of stock`);
      }

      // Add each item to cart
      let addedCount = 0;
      for (const item of orderItems) {
        // Check if product is in stock
        const product = products?.find(p => p.id === item.product_id);
        if (!product?.in_stock) continue;

        // Check if item already in cart
        const { data: existing } = await supabase
          .from("cart_items")
          .select()
          .eq("user_id", user.id)
          .eq("product_id", item.product_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("cart_items")
            .update({ 
              quantity: existing.quantity + item.quantity,
              selected_weight: item.selected_weight || existing.selected_weight
            })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("cart_items")
            .insert({
              user_id: user.id,
              product_id: item.product_id,
              quantity: item.quantity,
              selected_weight: item.selected_weight
            });
        }
        addedCount++;
      }

      // Invalidate cart queries
      queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });

      if (addedCount === 0) {
        toast.error("All items are out of stock");
      } else {
        toast.success(`Added ${addedCount} item(s) to cart`);
        navigate("/cart");
      }
    } catch (error: any) {
      console.error("Reorder error:", error);
      toast.error(error.message || "Failed to reorder");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleQuickReorder}
      disabled={disabled || orderItems.length === 0}
    >
      <ShoppingCart className="h-4 w-4 mr-2" />
      Quick Reorder
    </Button>
  );
}

