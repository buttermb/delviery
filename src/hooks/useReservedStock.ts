import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useReservedStock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reserveStock = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const { data, error } = await supabase.rpc("reserve_inventory_for_order", {
        p_product_id: productId,
        p_quantity: quantity,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (success) => {
      if (!success) {
        toast({ title: "Insufficient Stock", description: "Not enough available inventory", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const releaseStock = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const { error } = await supabase.rpc("release_reserved_inventory", {
        p_product_id: productId,
        p_quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const commitStock = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const { error } = await supabase.rpc("commit_reserved_inventory", {
        p_product_id: productId,
        p_quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const getAvailableStock = (stockQuantity: number, reservedQuantity: number = 0) => {
    return Math.max(0, stockQuantity - reservedQuantity);
  };

  return { reserveStock, releaseStock, commitStock, getAvailableStock };
}
