import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";

export interface LocationInventoryItem {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  location?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface LocationInventorySummary {
  product_id: string;
  product_name: string;
  sku: string;
  total_quantity: number;
  total_reserved: number;
  available_quantity: number;
  location_count: number;
}

export const useLocationInventory = (locationId?: string) => {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Get inventory for a specific location or all locations
  const inventoryQuery = useQuery({
    queryKey: ["location-inventory", tenant?.id, locationId],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from("location_inventory")
        .select(`
          *,
          location:locations(id, name),
          product:products(id, name, sku)
        `)
        .eq("tenant_id", tenant.id);

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocationInventoryItem[];
    },
    enabled: !!tenant?.id,
  });

  // Get aggregated inventory summary across all locations
  const summaryQuery = useQuery({
    queryKey: ["location-inventory-summary", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("location_inventory")
        .select(`
          product_id,
          quantity,
          reserved_quantity,
          product:products(id, name, sku)
        `)
        .eq("tenant_id", tenant.id);

      if (error) throw error;

      // Aggregate by product
      const summaryMap = new Map<string, LocationInventorySummary>();
      
      for (const item of data || []) {
        const productId = item.product_id;
        const existing = summaryMap.get(productId);
        
        if (existing) {
          existing.total_quantity += item.quantity || 0;
          existing.total_reserved += item.reserved_quantity || 0;
          existing.available_quantity = existing.total_quantity - existing.total_reserved;
          existing.location_count += 1;
        } else {
          const product = item.product as { id: string; name: string; sku: string } | null;
          summaryMap.set(productId, {
            product_id: productId,
            product_name: product?.name || "Unknown",
            sku: product?.sku || "",
            total_quantity: item.quantity || 0,
            total_reserved: item.reserved_quantity || 0,
            available_quantity: (item.quantity || 0) - (item.reserved_quantity || 0),
            location_count: 1,
          });
        }
      }

      return Array.from(summaryMap.values());
    },
    enabled: !!tenant?.id,
  });

  // Get inventory for a specific product across all locations
  const getProductInventory = (productId: string) => {
    return inventoryQuery.data?.filter(item => item.product_id === productId) || [];
  };

  // Update inventory quantity at a location
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ 
      locationId, 
      productId, 
      quantity,
      adjustmentType = 'set'
    }: { 
      locationId: string; 
      productId: string; 
      quantity: number;
      adjustmentType?: 'set' | 'add' | 'subtract';
    }) => {
      if (!tenant?.id) throw new Error("No tenant");

      // First check if record exists
      const { data: existing } = await supabase
        .from("location_inventory")
        .select("id, quantity")
        .eq("location_id", locationId)
        .eq("product_id", productId)
        .eq("tenant_id", tenant.id)
        .single();

      let newQuantity = quantity;
      if (adjustmentType === 'add') {
        newQuantity = (existing?.quantity || 0) + quantity;
      } else if (adjustmentType === 'subtract') {
        newQuantity = Math.max(0, (existing?.quantity || 0) - quantity);
      }

      if (newQuantity < 0) {
        throw new Error("Cannot set negative quantity");
      }

      if (existing) {
        const { error } = await supabase
          .from("location_inventory")
          .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("location_inventory")
          .insert({
            location_id: locationId,
            product_id: productId,
            tenant_id: tenant.id,
            quantity: newQuantity,
            reserved_quantity: 0,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["location-inventory-summary"] });
      toast.success("Inventory updated");
    },
    onError: (error) => {
      toast.error(`Failed to update inventory: ${error.message}`);
    },
  });

  return {
    inventory: inventoryQuery.data || [],
    summary: summaryQuery.data || [],
    isLoading: inventoryQuery.isLoading || summaryQuery.isLoading,
    error: inventoryQuery.error || summaryQuery.error,
    getProductInventory,
    updateQuantity: updateQuantityMutation.mutate,
    isUpdating: updateQuantityMutation.isPending,
    refetch: () => {
      inventoryQuery.refetch();
      summaryQuery.refetch();
    },
  };
};
