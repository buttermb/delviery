import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";

export const useWholesaleClients = () => {
  return useQuery({
    queryKey: ["wholesale-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_clients")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
};

export const useWholesaleOrders = () => {
  return useQuery({
    queryKey: ["wholesale-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_orders")
        .select(`
          *,
          client:wholesale_clients(business_name, contact_name),
          runner:wholesale_runners(full_name, phone)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
};

export const useCreateWholesaleOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: any) => {
      const { data, error } = await supabase.functions.invoke('wholesale-order-create', {
        body: orderData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-orders"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-clients"] });
      showSuccessToast("Order Created", "Wholesale order created successfully");
    },
    onError: (error) => {
      showErrorToast("Order Failed", error instanceof Error ? error.message : "Failed to create order");
    }
  });
};

export const useProcessPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: any) => {
      const { data, error } = await supabase.functions.invoke('wholesale-payment-process', {
        body: paymentData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-clients"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-payments"] });
      showSuccessToast("Payment Processed", "Payment recorded successfully");
    },
    onError: (error) => {
      showErrorToast("Payment Failed", error instanceof Error ? error.message : "Failed to process payment");
    }
  });
};

export const useAssignDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { order_id: string; runner_id: string }) => {
      const { data: result, error } = await supabase.functions.invoke('wholesale-delivery-assign', {
        body: data
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-orders"] });
      queryClient.invalidateQueries({ queryKey: ["wholesale-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      showSuccessToast("Delivery Assigned", "Runner assigned successfully");
    },
    onError: (error) => {
      showErrorToast("Assignment Failed", error instanceof Error ? error.message : "Failed to assign delivery");
    }
  });
};

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { delivery_id: string; status: string; location?: any; notes?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('wholesale-delivery-update', {
        body: data
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wholesale-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["active-deliveries"] });
      showSuccessToast("Status Updated", "Delivery status updated successfully");
    },
    onError: (error) => {
      showErrorToast("Update Failed", error instanceof Error ? error.message : "Failed to update status");
    }
  });
};
