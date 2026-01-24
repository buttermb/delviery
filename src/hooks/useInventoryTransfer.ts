import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";

export interface InventoryTransfer {
  id: string;
  tenant_id: string;
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  quantity: number;
  status: string;
  initiated_by: string | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  transfer_number: string;
}

export interface CreateTransferInput {
  sourceLocationId: string;
  destinationLocationId: string;
  productId: string;
  quantity: number;
  notes?: string;
}

export const useInventoryTransfer = () => {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const transfersQuery = useQuery({
    queryKey: ["inventory-transfers", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("inventory_transfers")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as InventoryTransfer[];
    },
    enabled: !!tenant?.id,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { data: sourceInventory } = await supabase
        .from("location_inventory")
        .select("quantity, reserved_quantity")
        .eq("location_id", input.sourceLocationId)
        .eq("product_id", input.productId)
        .eq("tenant_id", tenant.id)
        .single();

      const availableQty = (sourceInventory?.quantity || 0) - (sourceInventory?.reserved_quantity || 0);
      if (availableQty < input.quantity) {
        throw new Error(`Insufficient stock. Available: ${availableQty}`);
      }

      const transferNumber = `TRN-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("inventory_transfers").insert({
        account_id: tenant.id,
        from_location_id: input.sourceLocationId,
        to_location_id: input.destinationLocationId,
        product_id: input.productId,
        quantity: input.quantity,
        status: 'pending',
        initiated_by: admin?.id || null,
        notes: input.notes || null,
        transfer_number: transferNumber,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Transfer created");
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  const completeTransferMutation = useMutation({
    mutationFn: async (transferId: string) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { data: transfer } = await supabase
        .from("inventory_transfers")
        .select("*")
        .eq("id", transferId)
        .eq("tenant_id", tenant.id)
        .single();
      if (!transfer || transfer.status !== 'pending') throw new Error("Invalid transfer");

      // Deduct from source, add to destination
      const { data: sourceInv } = await supabase.from("location_inventory")
        .select("quantity").eq("location_id", transfer.from_location_id)
        .eq("product_id", transfer.product_id).single();

      await supabase.from("location_inventory").update({ 
        quantity: Math.max(0, (sourceInv?.quantity || 0) - transfer.quantity) 
      }).eq("location_id", transfer.from_location_id).eq("product_id", transfer.product_id);

      const { data: destInv } = await supabase.from("location_inventory")
        .select("id, quantity").eq("location_id", transfer.to_location_id)
        .eq("product_id", transfer.product_id).single();

      if (destInv) {
        await supabase.from("location_inventory").update({ quantity: destInv.quantity + transfer.quantity }).eq("id", destInv.id);
      } else {
        await supabase.from("location_inventory").insert({
          location_id: transfer.to_location_id, product_id: transfer.product_id,
          tenant_id: tenant.id, quantity: transfer.quantity, reserved_quantity: 0,
        });
      }

      await supabase.from("inventory_transfers").update({ status: 'completed', completed_at: new Date().toISOString() }).eq("id", transferId).eq("tenant_id", tenant.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["location-inventory"] });
      toast.success("Transfer completed");
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  const cancelTransferMutation = useMutation({
    mutationFn: async (transferId: string) => {
      if (!tenant?.id) throw new Error("No tenant");
      await supabase.from("inventory_transfers").update({ status: 'cancelled' }).eq("id", transferId).eq("tenant_id", tenant.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Transfer cancelled");
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    transfers: transfersQuery.data || [],
    isLoading: transfersQuery.isLoading,
    createTransfer: createTransferMutation.mutate,
    completeTransfer: completeTransferMutation.mutate,
    cancelTransfer: cancelTransferMutation.mutate,
    isCreating: createTransferMutation.isPending,
  };
};
